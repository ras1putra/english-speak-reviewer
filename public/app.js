'use strict';

(function () {
    const STORAGE_KEY = 'english-speak-reviewer-id';
    const COOKIE_KEY = 'english-speak-reviewer-id';
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const getBcrypt = () => {
        if (window.dcodeIO && window.dcodeIO.bcrypt) {
            return window.dcodeIO.bcrypt;
        }
        console.error('bcryptjs failed to load');
        return null;
    };

    const setUserIdOnFields = (id) => {
        document.querySelectorAll('[data-user-id-field]').forEach((input) => {
            if (input instanceof HTMLInputElement) {
                input.value = id;
            }
        });
    };

    const hideLoginModal = () => {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.remove();
        }
    };

    const revealNavbar = () => {
        document.querySelectorAll('[data-navbar]').forEach((nav) => {
            nav.classList.remove('hidden');
            nav.removeAttribute('aria-hidden');
        });
    };

    const toggleInputClasses = (hasError) => {
        const emailInput = document.getElementById('email');
        if (!(emailInput instanceof HTMLInputElement)) {
            return;
        }

        const normalClasses = (emailInput.dataset.normalClasses || '').split(' ').filter(Boolean);
        const errorClasses = (emailInput.dataset.errorClasses || '').split(' ').filter(Boolean);

        if (hasError) {
            emailInput.classList.remove(...normalClasses);
            emailInput.classList.add(...errorClasses);
        } else {
            emailInput.classList.remove(...errorClasses);
            emailInput.classList.add(...normalClasses);
        }
    };

    const showError = (message) => {
        const errorRow = document.getElementById('login-error');
        const errorText = document.getElementById('login-error-text');
        if (errorRow && errorText) {
            errorRow.classList.remove('hidden');
            errorText.textContent = message;
        }
        toggleInputClasses(true);
    };

    const clearError = () => {
        const errorRow = document.getElementById('login-error');
        const errorText = document.getElementById('login-error-text');
        if (errorRow && errorText) {
            errorRow.classList.add('hidden');
            errorText.textContent = '';
        }
        toggleInputClasses(false);
    };

    const attachHtmxHeaderSync = () => {
        document.body.addEventListener('htmx:configRequest', (event) => {
            const userId = localStorage.getItem(STORAGE_KEY);
            if (!userId) {
                return;
            }
            event.detail.headers = event.detail.headers || {};
            event.detail.headers['x-user-id'] = userId;
        });
    };

    const persistUserId = (id) => {
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch (error) {
            console.error('Failed to persist id to localStorage', error);
        }

        try {
            document.cookie = `${COOKIE_KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        } catch (error) {
            console.error('Failed to write id cookie', error);
        }
    };

    const wireLoginForm = () => {
        const container = document.getElementById('login-form');
        const submitButton = document.getElementById('login-submit');
        const input = document.getElementById('email');

        if (!(container && submitButton instanceof HTMLButtonElement && input instanceof HTMLInputElement)) {
            return;
        }

        const handleSubmit = () => {
            const email = input.value.trim().toLowerCase();

            if (!email) {
                showError('Email is required');
                return;
            }

            if (!EMAIL_PATTERN.test(email)) {
                showError('Please enter a valid email address');
                return;
            }

            clearError();

            try {
                const bcrypt = getBcrypt();
                if (!bcrypt) {
                    throw new Error('bcrypt unavailable');
                }

                const hashedId = bcrypt.hashSync(email, 10);
                persistUserId(hashedId);
                setUserIdOnFields(hashedId);
                hideLoginModal();
                revealNavbar();
            } catch (error) {
                console.error('Failed to hash email', error);
                showError('Something went wrong. Please try again.');
            }
        };

        submitButton.addEventListener('click', (event) => {
            event.preventDefault();
            handleSubmit();
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
            }
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        attachHtmxHeaderSync();
        wireLoginForm();

        const storedId = localStorage.getItem(STORAGE_KEY);
        if (storedId) {
            persistUserId(storedId);
            setUserIdOnFields(storedId);
            hideLoginModal();
            revealNavbar();
        }
    });
})();
