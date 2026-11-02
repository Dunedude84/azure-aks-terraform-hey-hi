document.addEventListener('DOMContentLoaded', () => {
    const addBookForm = document.getElementById('add-book-form');
    const searchInput = document.getElementById('search');
    const clearBtn = document.getElementById('clear-search');
    const booksGrid = document.getElementById('books-grid');
    const messageDiv = document.getElementById('message');

    let customThumbnail = null;

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

            const data = await response.json();

            if (response.ok) {
                showMessage('Livre ajouté avec succès !', 'success');
                isbnInput.value = '';
                searchInput.value = '';
                fetchBooks();
            } else {
                showMessage(data.message || 'Erreur lors de l\'ajout', 'error');
            }
        } catch (err) {
            showMessage('Erreur de connexion au serveur', 'error');
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
            <div class="book-card" data-id="${book._id}" onclick="openModal('${book._id}', ${JSON.stringify(book).replace(/'/g, "\\'").replace(/"/g, '&quot;')})">
                <div class="book-img">
                    ${hasThumbnail ? `<img src="${book.customThumbnail || book.thumbnail}" alt="${book.title}">` : '<span>Pas d\'image</span>'}
                </div>
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">${book.authors.join(', ')}</p>
                    <div class="book-meta">
                        <span>${book.pageCount} pages</span>
                        <div class="book-actions">
                            ${!hasThumbnail ? `<button class="upload-thumbnail-btn" onclick="event.stopPropagation(); uploadThumbnail('${book._id}')">Ajouter une image</button>` : ''}
                            <button class="delete-btn" onclick="event.stopPropagation(); deleteBook('${book._id}')">Supprimer</button>
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
    }

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
        
        const metaInfo = [];
        if (book.pageCount) metaInfo.push(`${book.pageCount} pages`);
        if (book.publishedDate) metaInfo.push(`Publié en ${book.publishedDate}`);
        if (book.isbn) metaInfo.push(`ISBN: ${book.isbn}`);
        
        document.getElementById('modal-meta').textContent = metaInfo.join(' | ');
        
        // Reset subjects while loading
        document.getElementById('modal-subjects-list').textContent = 'Chargement...';
        
        const modal = document.getElementById('book-modal');
        if (book.thumbnail) {
            document.getElementById('modal-cover').src = book.thumbnail;
        } else {
            document.getElementById('modal-cover').src = '';
        }
        
        modal.style.display = 'block';

        // Fetch extra details
        try {
            const response = await fetch(`/api/books/${id}/extra`);
            if (response.ok) {
                const extra = await response.json();
                document.getElementById('modal-subjects-list').textContent = extra.subjects.length > 0 
                    ? extra.subjects.join(', ') 
                    : 'Aucun sujet disponible';
                
                if (extra.editions_count > 0) {
                    document.getElementById('modal-editions').textContent = `${extra.editions_count} éditions`;
                }
                
                if (extra.authors && extra.authors.length > 0) {
                    const authorBio = extra.authors[0].bio || 'Aucune biographie disponible';
                    document.getElementById('modal-author-bio').textContent = authorBio;
                } else {
                    document.getElementById('modal-author-bio').textContent = 'Aucune information sur l\'auteur.';
                }
            } else {
                document.getElementById('modal-subjects-list').textContent = 'Impossible de charger les sujets.';
            }
        } catch (err) {
            document.getElementById('modal-subjects-list').textContent = 'Erreur de chargement.';
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
