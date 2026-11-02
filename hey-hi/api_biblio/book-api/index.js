const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

app.use(express.json({ limit: '10mb', strict: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_temporaire',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static files (login page & assets must be accessible before auth)
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware: protect everything except the login assets/routes
app.use((req, res, next) => {
    const publicPaths = ['/login.html', '/api/login'];
    const isPublic = publicPaths.includes(req.path) || req.path.startsWith('/css/') || req.path.startsWith('/js/');
    if (isPublic) return next();
    if (!req.session.authenticated) {
        if (req.path.startsWith('/api')) return res.status(401).json({ message: 'Non autorisé' });
        return res.redirect('/login.html');
    }
    next();
});

// Login route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedPass = process.env.APP_PASSWORD;
    if (username === expectedUser && password === expectedPass) {
        req.session.authenticated = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, message: 'Identifiants incorrects' });
});

// Logout route
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('my_books');
        console.log('Connecté à MongoDB (Biblio)');
    } catch (err) {
        console.error('Erreur de connexion MongoDB Biblio:', err.message);
        process.exit(1);
    }
}

// Upload custom thumbnail
app.post('/api/upload-thumbnail', express.json({ limit: '10mb', strict: true, type: ['application/json', 'application/vnd.api+json'] }), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ message: 'Image requise' });

        // Store the image directly as a base64 data URI in MongoDB (no local disk),
        // so it stays available across all machines sharing the same cluster.
        res.json({ url: image });
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(400).json({ message: 'Requête invalide. Content-Type doit être application/json.' });
    }
});

// Update book with custom thumbnail
app.patch('/api/books/:id/thumbnail', async (req, res) => {
    try {
        const { id } = req.params;
        const { customThumbnail } = req.body;
        
        await db.collection('books').updateOne(
            { _id: new ObjectId(id) },
            { $set: { customThumbnail } }
        );
        res.status(204).send();
    } catch (err) {
        console.error('PATCH /api/books/:id/thumbnail error:', err.message);
        res.status(500).json({ message: 'Erreur lors de la mise à jour' });
    }
});

// Update book read status
app.patch('/api/books/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const { read } = req.body;

        await db.collection('books').updateOne(
            { _id: new ObjectId(id) },
            { $set: { read: Boolean(read) } }
        );
        res.status(204).send();
    } catch (err) {
        console.error('PATCH /api/books/:id/read error:', err.message);
        res.status(500).json({ message: 'Erreur lors de la mise à jour' });
    }
});

// Get all books with optional search
app.get('/api/books', async (req, res) => {
    try {
        const { q } = req.query;
        let filter = {};

        if (q) {
            const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter = {
                $or: [
                    { title: regex },
                    { authors: { $elemMatch: { $regex: regex } } },
                    { isbn: regex }
                ]
            };
        }

        const books = await db.collection('books').find(filter).sort({ addedAt: -1 }).toArray();
        res.json(books);
    } catch (err) {
        console.error('GET /api/books error:', err.message);
        res.status(500).json({ message: 'Erreur lors de la récupération des livres' });
    }
});

// Add a book using ISBN via OpenLibrary (no API key required)
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.post('/api/books', async (req, res) => {
    const { isbn, customThumbnail } = req.body;
    console.log('POST /api/books:', isbn);
    if (!isbn) return res.status(400).json({ message: 'ISBN requis' });

    const cleanIsbn = isbn.trim();

    try {
        const existing = await db.collection('books').findOne({ isbn: cleanIsbn });
        if (existing) {
            return res.status(409).json({ message: 'Ce livre est déjà dans la collection' });
        }

        const olUrl = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(cleanIsbn)}&limit=1&fields=title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median`;
        let olRes;
        let olError;
        for (let attempt = 0; attempt < 3 && !olRes; attempt++) {
            try {
                olRes = await axios.get(olUrl, {
                    validateStatus: () => true,
                    timeout: 25000,
                    headers: { 'User-Agent': 'MaBibliothequeApp/1.0 (contact@example.org)' }
                });
            } catch (err) {
                olError = err;
            }
        }
        if (!olRes) throw olError;

        if (olRes.status !== 200) {
            console.error('OpenLibrary API error:', olRes.status, olRes.statusText, 'ISBN:', cleanIsbn);
            return res.status(503).json({ message: `Service OpenLibrary indisponible (${olRes.status})` });
        }

        const b = olRes.data && Array.isArray(olRes.data.docs) ? olRes.data.docs[0] : null;
        const returnedIsbns = b && Array.isArray(b.isbn)
            ? b.isbn.map(value => String(value).replace(/[^0-9X]/gi, '').toUpperCase())
            : [];
        const normalizedIsbn = cleanIsbn.replace(/[^0-9X]/gi, '').toUpperCase();
        if (!b || !returnedIsbns.includes(normalizedIsbn)) {
            console.error('OpenLibrary response missing ISBN:', cleanIsbn);
            return res.status(404).json({ message: 'ISBN introuvable sur OpenLibrary' });
        }

        const newBook = {
            title: b.title || 'Titre inconnu',
            authors: Array.isArray(b.author_name) && b.author_name.length > 0
                ? b.author_name.filter(Boolean)
                : ['Auteur inconnu'],
            isbn: cleanIsbn,
            thumbnail: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : '',
            customThumbnail: customThumbnail || '',
            description: 'Pas de description disponible.',
            pageCount: b.number_of_pages_median || 0,
            publishedDate: b.first_publish_year ? String(b.first_publish_year) : '',
            addedAt: new Date(),
            source: 'openlibrary',
            read: false
        };

        await db.collection('books').insertOne(newBook);
        res.status(201).json(newBook);
    } catch (err) {
        console.error('POST /api/books error:', err.message);
        if (axios.isAxiosError(err)) {
            return res.status(503).json({ message: 'OpenLibrary ne répond pas. Veuillez réessayer.' });
        }
        res.status(500).json({ message: 'Erreur lors de l\'ajout du livre' });
    }
});

// Get extra details from Open Library for a specific book
app.get('/api/books/:id/extra', async (req, res) => {
    try {
        const { id } = req.params;
        const book = await db.collection('books').findOne({ _id: new ObjectId(id) });
        
        if (!book || !book.isbn) {
            return res.status(404).json({ message: 'Livre ou ISBN non trouvé' });
        }

        const olRes = await axios.get(`https://openlibrary.org/isbn/${book.isbn}.json`, {
            validateStatus: () => true,
            timeout: 15000,
            headers: { 'User-Agent': 'MaBibliothequeApp/1.0 (contact@example.org)' }
        });

        if (olRes.status !== 200) {
            return res.status(503).json({ message: 'Service OpenLibrary indisponible' });
        }

        const edition = olRes.data;
        let work = null;
        let authorsDetails = [];

        if (edition.works && edition.works.length > 0) {
            const workKey = edition.works[0].key;
            const workRes = await axios.get(`https://openlibrary.org${workKey}.json`, {
                validateStatus: () => true,
                timeout: 15000,
                headers: { 'User-Agent': 'MaBibliothequeApp/1.0 (contact@example.org)' }
            });
            if (workRes.status === 200) work = workRes.data;
        }

        if (edition.authors) {
            const authorKeys = edition.authors.map(a => a.key);
            authorsDetails = await Promise.all(authorKeys.map(async (key) => {
                const authRes = await axios.get(`https://openlibrary.org${key}.json`, {
                    validateStatus: () => true,
                    timeout: 15000,
                    headers: { 'User-Agent': 'MaBibliothequeApp/1.0 (contact@example.org)' }
                });
                return authRes.status === 200 ? authRes.data : { name: 'Auteur inconnu' };
            }));
        }

        res.json({
            subjects: edition.subjects || (work ? work.subjects : []) || [],
            subject_places: work ? work.subject_places : [],
            subject_people: work ? work.subject_people : [],
            subject_times: work ? work.subject_times : [],
            editions_count: work ? work.edition_count : 0,
            authors: authorsDetails.map(a => ({
                name: a.name,
                birth_date: a.birth_date,
                death_date: a.death_date,
                bio: a.bio ? (typeof a.bio === 'string' ? a.bio : a.bio.value) : ''
            }))
        });

    } catch (err) {
        console.error('GET /api/books/:id/extra error:', err.message);
        res.status(500).json({ message: 'Erreur lors de la récupération des détails supplémentaires' });
    }
});

// Delete a book
app.delete('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.collection('books').deleteOne({ _id: new ObjectId(id) });
        res.status(204).send();
    } catch (err) {
        console.error('DELETE /api/books error:', err.message);
        res.status(500).json({ message: 'Erreur lors de la suppression' });
    }
});

async function start() {
    await connectDB();
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, '0.0.0.0', () => console.log(`API Biblio lancée sur le port ${PORT}`));
}

// Error handler (must be after all routes) - catches malformed JSON etc.
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        console.error('[JSON PARSE ERROR]', err.message, '- endpoint:', req.method, req.url, '- Content-Type:', req.headers['content-type']);
        return res.status(400).json({ message: 'JSON invalide dans la requête', error: err.message });
    }
    console.error('[UNHANDLED ERROR]', err.message, '- endpoint:', req.method, req.url);
    res.status(500).json({ message: 'Erreur interne du serveur' });
});

start();