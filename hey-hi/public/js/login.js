document.addEventListener('DOMContentLoaded', () => {
    // --- Tab switching ---
    const tabEmployee = document.getElementById('tab-employee');
    const tabAdmin = document.getElementById('tab-admin');
    const employeeForm = document.getElementById('employee-login-form');
    const adminForm = document.getElementById('login-form');
    const employeeGuestDivider = document.querySelector('.login-card > .guest-divider');
    const guestEmployeeBtn = document.getElementById('guest-employee-btn');

    tabEmployee.addEventListener('click', () => {
        tabEmployee.classList.add('active');
        tabAdmin.classList.remove('active');
        employeeForm.classList.remove('hidden');
        adminForm.classList.add('hidden');
        if (employeeGuestDivider) {
            employeeGuestDivider.classList.remove('hidden');
        }
        if (guestEmployeeBtn) {
            guestEmployeeBtn.classList.remove('hidden');
        }
    });

    tabAdmin.addEventListener('click', () => {
        tabAdmin.classList.add('active');
        tabEmployee.classList.remove('active');
        adminForm.classList.remove('hidden');
        employeeForm.classList.add('hidden');
        if (employeeGuestDivider) {
            employeeGuestDivider.classList.add('hidden');
        }
        if (guestEmployeeBtn) {
            guestEmployeeBtn.classList.add('hidden');
        }
    });

    function shakeCard() {
        const loginCard = document.querySelector('.login-card');
        loginCard.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(0)' }
        ], {
            duration: 400,
            easing: 'ease-in-out'
        });
    }

    // --- Admin login ---
    const adminUsernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = adminUsernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError(errorMessage, 'Veuillez entrer le nom d\'utilisateur et le mot de passe.');
            return;
        }

        errorMessage.classList.remove('show');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = '/';
            } else {
                showError(errorMessage, data.message || 'Nom d\'utilisateur ou mot de passe incorrect.');
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('Login error:', error);
            showError(errorMessage, 'Une erreur est survenue. Veuillez réessayer.');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    // --- Employee login ---
    const usernameInput = document.getElementById('emp-username');
    const empPasswordInput = document.getElementById('emp-password');
    const employeeErrorMessage = document.getElementById('employee-error-message');
    const employeeSubmitBtn = document.getElementById('employee-submit-btn');

    employeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = empPasswordInput.value;

        if (!username || !password) {
            showError(employeeErrorMessage, 'Veuillez entrer votre nom d\'utilisateur et votre mot de passe.');
            return;
        }

        employeeErrorMessage.classList.remove('show');
        employeeSubmitBtn.classList.add('loading');
        employeeSubmitBtn.disabled = true;

        try {
            const response = await fetch('/api/auth/employee-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = '/employee.html';
            } else {
                showError(employeeErrorMessage, data.message || 'Identifiants incorrects.');
                empPasswordInput.value = '';
                empPasswordInput.focus();
            }
        } catch (error) {
            console.error('Employee login error:', error);
            showError(employeeErrorMessage, 'Une erreur est survenue. Veuillez réessayer.');
        } finally {
            employeeSubmitBtn.classList.remove('loading');
            employeeSubmitBtn.disabled = false;
        }
    });

    function showError(el, message) {
        el.textContent = message;
        el.classList.add('show');
        shakeCard();
    }

    // --- Guest login ---
    async function guestLogin(role, btn, username, password, errorEl) {
        if (!username || !password) {
            showError(errorEl, 'Veuillez entrer le nom d\'utilisateur et le mot de passe pour le mode invité.');
            return;
        }

        if (errorEl) {
            errorEl.classList.remove('show');
        }
        btn.disabled = true;
        try {
            const response = await fetch('/api/auth/guest-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, username, password })
            });
            const data = await response.json();
            if (response.ok) {
                window.location.href = role === 'employee' ? '/employee.html' : '/';
            } else {
                showError(errorEl, data.message || 'Impossible de démarrer la visite en mode invité.');
                btn.disabled = false;
            }
        } catch (error) {
            console.error('Guest login error:', error);
            showError(errorEl, 'Une erreur est survenue. Veuillez réessayer.');
            btn.disabled = false;
        }
    }

    document.getElementById('guest-employee-btn').addEventListener('click', (e) => {
        guestLogin(
            'employee',
            e.currentTarget,
            usernameInput.value.trim(),
            empPasswordInput.value,
            employeeErrorMessage
        );
    });

    document.getElementById('guest-admin-btn').addEventListener('click', (e) => {
        guestLogin(
            'admin',
            e.currentTarget,
            adminUsernameInput.value.trim(),
            passwordInput.value,
            errorMessage
        );
    });
});
