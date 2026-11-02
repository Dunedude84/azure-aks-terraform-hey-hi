const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

// Faux profil employé utilisé pour la session invité (aucune donnée réelle, aucune écriture en BD)
const GUEST_EMPLOYEE = {
    id: 'guest',
    name: 'Employé Invité',
    department: 'caisses_avant',
    employeeType: 'temps-plein',
    weeklyHoursTarget: 37.5,
    seniority: 10,
    lunchBreakMinutes: 60,
    isFormation: false,
    isHeadCashier: false,
    vacations: [],
    availabilities: [0, 1, 2, 3, 4, 5, 6].map(day => ({
        dayOfWeek: day,
        weekStart: null,
        isAvailable: true,
        isFixed: false,
        startTime: '09:00',
        endTime: '17:00'
    }))
};

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Vérification du nom d'utilisateur et du mot de passe administrateur dans .env
    const correctUsername = process.env.ADMIN_USERNAME;
    const correctPassword = process.env.APP_PASSWORD;

    // Rendre la vérification un peu plus tolérante (espaces)
    const usernameMatch = username && correctUsername && username.trim().toLowerCase() === correctUsername.trim().toLowerCase();
    const passwordMatch = password && correctPassword && password.trim() === correctPassword.trim();

    if (usernameMatch && passwordMatch) {
        // Création de la session
        req.session.authenticated = true;
        req.session.role = 'admin';
        req.session.isGuest = false;
        req.session.employeeId = null;
        res.status(200).json({ success: true, message: 'Connexion réussie', role: 'admin' });
    } else {
        res.status(401).json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
});

// Connexion employé (nom d'utilisateur + mot de passe)
router.post('/employee-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et mot de passe requis' });
        }

        const employee = await Employee.findOne({ username: username.trim().toLowerCase() });
        if (!employee || !employee.passwordHash) {
            return res.status(401).json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        const match = await bcrypt.compare(password, employee.passwordHash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        req.session.authenticated = true;
        req.session.role = 'employee';
        req.session.isGuest = false;
        req.session.employeeId = employee.id;
        res.status(200).json({ success: true, message: 'Connexion réussie', role: 'employee' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Connexion invité (démonstration) - accès en lecture seule, aucune écriture en BD
router.post('/guest-login', (req, res) => {
    const { role, username, password } = req.body;
    if (role !== 'admin' && role !== 'employee') {
        return res.status(400).json({ success: false, message: 'Rôle invité invalide' });
    }

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et mot de passe requis' });
    }

    const guestUsername = (process.env.GUEST_USERNAME || process.env.ADMIN_USERNAME || '').trim().toLowerCase();
    const guestPassword = (process.env.GUEST_PASSWORD || process.env.APP_PASSWORD || '').trim();
    const usernameMatch = username.trim().toLowerCase() === guestUsername;
    const passwordMatch = password.trim() === guestPassword;

    if (!usernameMatch || !passwordMatch) {
        return res.status(401).json({ success: false, message: 'Accès invité refusé : identifiants invalides' });
    }

    req.session.authenticated = true;
    req.session.role = role;
    req.session.isGuest = true;
    req.session.employeeId = null;
    res.status(200).json({ success: true, message: 'Connexion invité réussie', role, guest: true });
});

// Informations sur la session courante
router.get('/me', async (req, res) => {
    if (!req.session || !req.session.authenticated) {
        return res.status(401).json({ authenticated: false });
    }

    if (req.session.role === 'employee') {
        if (req.session.isGuest) {
            return res.json({ authenticated: true, role: 'employee', guest: true, employee: GUEST_EMPLOYEE });
        }
        try {
            const employee = await Employee.findById(req.session.employeeId);
            if (!employee) {
                return res.status(401).json({ authenticated: false });
            }
            return res.json({ authenticated: true, role: 'employee', employee });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    }

    return res.json({ authenticated: true, role: 'admin', guest: !!req.session.isGuest });
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la déconnexion' });
        }
        res.clearCookie('connect.sid'); // Nom par défaut du cookie de session express
        res.status(200).json({ success: true, message: 'Déconnexion réussie' });
    });
});

module.exports = router;
module.exports.GUEST_EMPLOYEE = GUEST_EMPLOYEE;
