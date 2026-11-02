require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration de la session
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_temporaire',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 jour
}));

// Fichiers statiques publics (pour la page de login)
app.use('/css/login.css', express.static(path.join(__dirname, 'public/css/login.css')));
app.use('/js/login.js', express.static(path.join(__dirname, 'public/js/login.js')));
app.use('/login.html', express.static(path.join(__dirname, 'public/login.html')));

// Route d'authentification (publique)
app.use('/api/auth', authRoutes);

// Redirection vers l'application biblio (localhost en dev, Cloudflare Tunnel en prod)
app.get('/biblio-login', (req, res) => {
    const isLocal = /^(localhost|127\.0\.0\.1|::1)(:\d+)?$/.test(req.hostname) || req.hostname === 'localhost';
    let target = 'https://biblio.hey-hi.ca/login.html';
    if (isLocal) {
        target = `http://${req.hostname}:3001/login.html`;
    } else if (req.hostname.startsWith('aks')) {
        target = 'https://aks-biblio.hey-hi.ca/login.html';
    }
    res.redirect(target);
});

// Préfixes d'API accessibles aux employés (accès simplifié : disponibilités uniquement)
const EMPLOYEE_ALLOWED_API_PREFIXES = ['/api/auth', '/api/employees/me'];

// Middleware de protection
app.use((req, res, next) => {
    if (req.session && req.session.authenticated) {
        const role = req.session.role || 'admin';

        // Mode invité (démonstration) : accès en lecture seule, aucune écriture en BD
        if (req.session.isGuest && req.path.startsWith('/api') && req.method !== 'GET') {
            return res.status(403).json({ message: "Mode invité : cette action est désactivée. Aucune modification n'est enregistrée." });
        }

        if (role === 'employee') {
            if (req.path.startsWith('/api')) {
                const allowed = EMPLOYEE_ALLOWED_API_PREFIXES.some(prefix => req.path.startsWith(prefix));
                if (!allowed) {
                    return res.status(403).json({ message: 'Accès refusé : réservé aux administrateurs' });
                }
                return next();
            }

            // Les employés n'ont accès qu'à leur portail simplifié
            if (req.path === '/' || req.path === '/index.html') {
                return res.redirect('/employee.html');
            }
        }

        return next();
    }
    
    // Si c'est un appel API, renvoyer 401
    if (req.path.startsWith('/api')) {
        return res.status(401).json({ message: 'Non autorisé' });
    }
    
    // Sinon, rediriger vers la page de connexion
    res.redirect('/login.html');
});

// Serve protected static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const dbPromise = mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    throw err;
});

// API Routes
app.use('/api', apiRoutes);

// Catch-all route to serve the frontend
app.use((req, res) => {
    if (req.session && req.session.role === 'employee') {
        return res.sendFile(path.join(__dirname, 'public', 'employee.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
module.exports.dbPromise = dbPromise;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
