document.addEventListener('DOMContentLoaded', () => {
    const addBookForm = document.getElementById('add-book-form');
    const searchInput = document.getElementById('search');
    const clearBtn = document.getElementById('clear-search');
    const booksGrid = document.getElementById('books-grid');
    const messageDiv = document.getElementById('message');
    const logoutBtn = document.getElementById('logout-btn');

    let customThumbnail = null;

    // Logout handler
    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (response.ok) {
                const host = window.location.hostname;
                if (host === 'localhost' || host === '127.0.0.1') {
                    window.location.href = 'http://localhost:3000/login.html';
                } else if (host.startsWith('aks')) {
                    window.location.href = 'https://aks.hey-hi.ca/login.html';
                } else {
                    window.location.href = 'https://hey-hi.ca/login.html';
                }
            } else {
                alert('Erreur lors de la déconnexion');
            }
        } catch (err) {
            alert('Erreur de connexion lors de la déconnexion');
        }
    });

    // Load books on startup
    fetchBooks();

    // Search functionality
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchBooks(searchInput.value.trim()), 300);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        fetchBooks();
    });



    addBookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isbnInput = document.getElementById('isbn');
        const isbn = isbnInput.value.trim();

        if (!isbn) return;

        showMessage('Ajout du livre en cours...', 'info');

        try {
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isbn, customThumbnail })
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                data = { message: `Réponse inattendue (HTTP ${response.status}): ${text.slice(0, 200)}` };
            }

            if (response.ok) {
                showMessage('Livre ajouté avec succès !', 'success');
                isbnInput.value = '';
                searchInput.value = '';
                fetchBooks();
            } else {
                showMessage(data.message || `Erreur HTTP ${response.status}`, 'error');
            }
        } catch (err) {
            showMessage('Erreur de connexion au serveur: ' + (err.message || ''), 'error');
        }
    });

    async function fetchBooks(query = '') {
        try {
            const url = query ? `/api/books?q=${encodeURIComponent(query)}` : '/api/books';
            const response = await fetch(url);
            const books = await response.json();
            renderBooks(Array.isArray(books) ? books : []);
        } catch (err) {
            booksGrid.innerHTML = '<p class="error">Erreur lors du chargement des livres.</p>';
        }
    }

    function renderBooks(books) {
        if (books.length === 0) {
            booksGrid.innerHTML = '<p class="empty-msg">Aucun livre dans votre collection. Ajoutez-en un !</p>';
            return;
        }

        booksGrid.innerHTML = books.map(book => {
            const hasThumbnail = book.thumbnail || book.customThumbnail;
            return `
            <div class="book-card" data-id="${book._id}">
                <div class="book-img">
                    ${hasThumbnail
                        ? `<img src="${book.customThumbnail || book.thumbnail}" alt="${book.title}" onerror="handleImageError(this)">
                           <span class="no-image-text hidden">Pas d'image</span>`
                        : '<span class="no-image-text">Pas d\'image</span>'}
                </div>
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">${book.authors.join(', ')}</p>
                    <label class="read-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${book.read ? 'checked' : ''} onchange="toggleRead('${book._id}', this.checked)">
                        Lu
                    </label>
                    <div class="book-meta">
                        <span>${book.pageCount} pages</span>
                        <div class="book-actions">
                            <button class="upload-thumbnail-btn ${hasThumbnail ? 'hidden' : ''}" onclick="event.stopPropagation(); uploadThumbnail('${book._id}')">Ajouter une image</button>
                            <button class="delete-btn" onclick="event.stopPropagation(); deleteBook('${book._id}')">Supprimer</button>
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');

        booksGrid.querySelectorAll('.book-card').forEach(card => {
            const id = card.dataset.id;
            const book = books.find(b => b._id === id);
            if (book) {
                card.addEventListener('click', () => openModal(id, book));
            }
        });
    }

    window.handleImageError = (img) => {
        img.style.display = 'none';
        const placeholder = img.nextElementSibling;
        if (placeholder) placeholder.classList.remove('hidden');
        const card = img.closest('.book-card');
        const uploadBtn = card ? card.querySelector('.upload-thumbnail-btn') : null;
        if (uploadBtn) uploadBtn.classList.remove('hidden');
    };

    window.toggleRead = async (id, read) => {
        try {
            const response = await fetch(`/api/books/${id}/read`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read })
            });
            if (!response.ok) {
                alert('Erreur lors de la mise à jour du statut de lecture');
            }
        } catch (err) {
            alert('Erreur de connexion');
        }
    };

    window.deleteBook = async (id) => {
        if (!confirm('Voulez-vous vraiment supprimer ce livre ?')) return;

        try {
            const response = await fetch(`/api/books/${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchBooks();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch (err) {
            alert('Erreur de connexion');
        }
    };

    window.openModal = async (id, book) => {
        document.getElementById('modal-title').textContent = book.title;
        document.getElementById('modal-authors').textContent = book.authors.join(', ');
        document.getElementById('modal-description').textContent = book.description || 'Aucune description disponible';

        document.getElementById('modal-pages').textContent = book.pageCount ? `${book.pageCount} pages` : '';
        document.getElementById('modal-date').textContent = book.publishedDate ? `Publié en ${book.publishedDate}` : '';
        document.getElementById('modal-isbn').textContent = book.isbn ? `ISBN: ${book.isbn}` : '';

        document.getElementById('modal-subjects-list').textContent = 'Chargement...';
        document.getElementById('modal-editions').textContent = '';
        document.getElementById('modal-author-bio').textContent = 'Chargement...';

        document.getElementById('modal-cover').src = book.customThumbnail || book.thumbnail || '';

        const modal = document.getElementById('book-modal');
        modal.style.display = 'block';

        try {
            const response = await fetch(`/api/books/${id}/extra`);
            if (response.ok) {
                const extra = await response.json();
                document.getElementById('modal-subjects-list').textContent = (extra.subjects && extra.subjects.length > 0)
                    ? extra.subjects.join(', ')
                    : 'Aucun sujet disponible';

                if (extra.editions_count > 0) {
                    document.getElementById('modal-editions').textContent = `${extra.editions_count} éditions`;
                } else {
                    document.getElementById('modal-editions').textContent = '';
                }

                if (extra.authors && extra.authors.length > 0) {
                    document.getElementById('modal-author-bio').textContent = extra.authors[0].bio || 'Aucune biographie disponible';
                } else {
                    document.getElementById('modal-author-bio').textContent = 'Aucune information sur l\'auteur.';
                }
            } else {
                document.getElementById('modal-subjects-list').textContent = 'Impossible de charger les sujets.';
                document.getElementById('modal-author-bio').textContent = 'Aucune information sur l\'auteur.';
            }
        } catch (err) {
            document.getElementById('modal-subjects-list').textContent = 'Erreur de chargement.';
            document.getElementById('modal-author-bio').textContent = 'Aucune information sur l\'auteur.';
        }
    };

    window.uploadThumbnail = async (id) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.click();
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    // Upload image
                    const uploadRes = await fetch('/api/upload-thumbnail', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: event.target.result })
                    });
                    
                    if (uploadRes.ok) {
                        const data = await uploadRes.json();
                        
                        // Update book with custom thumbnail
                        const updateRes = await fetch(`/api/books/${id}/thumbnail`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ customThumbnail: data.url })
                        });
                        
                        if (updateRes.ok) {
                            showMessage('Image ajoutée avec succès !', 'success');
                            fetchBooks(); // Refresh the list
                        }
                    }
                } catch (err) {
                    console.error('Upload error:', err);
                    showMessage('Erreur lors de l\'ajout de l\'image', 'error');
                }
            };
            reader.readAsDataURL(file);
        });
    };

    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('book-modal').style.display = 'none';
    });

    document.getElementById('book-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('book-modal')) {
            document.getElementById('book-modal').style.display = 'none';
        }
    });

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                if (messageDiv.textContent === text) {
                    messageDiv.className = 'message';
                }
            }, 5000);
        }
    }
});
