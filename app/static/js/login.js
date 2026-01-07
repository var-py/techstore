document.addEventListener('DOMContentLoaded', function() {
    // Элементы формы
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const loginBtn = document.getElementById('loginBtn');
    const rememberMe = document.getElementById('rememberMe');

    // Элементы для отображения ошибок
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');

    // Валидация email
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Валидация пароля
    function validatePassword(password) {
        return password.length >= 6;
    }

    // Показать/скрыть пароль
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        const icon = this.querySelector('i');
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });

    // Валидация формы в реальном времени
    emailInput.addEventListener('input', function() {
        if (!validateEmail(this.value)) {
            emailError.textContent = 'Введите корректный email адрес';
            this.style.borderColor = '#e74c3c';
        } else {
            emailError.textContent = '';
            this.style.borderColor = '#28a745';
        }
    });

    passwordInput.addEventListener('input', function() {
        if (!validatePassword(this.value)) {
            passwordError.textContent = 'Пароль должен содержать минимум 6 символов';
            this.style.borderColor = '#e74c3c';
        } else {
            passwordError.textContent = '';
            this.style.borderColor = '#28a745';
        }
    });

    // Обработка отправки формы
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        let isValid = true;

        // Валидация email
        if (!validateEmail(email)) {
            emailError.textContent = 'Введите корректный email адрес';
            emailInput.style.borderColor = '#e74c3c';
            isValid = false;
        } else {
            emailError.textContent = '';
            emailInput.style.borderColor = '#28a745';
        }

        // Валидация пароля
        if (!validatePassword(password)) {
            passwordError.textContent = 'Пароль должен содержать минимум 6 символов';
            passwordInput.style.borderColor = '#e74c3c';
            isValid = false;
        } else {
            passwordError.textContent = '';
            passwordInput.style.borderColor = '#28a745';
        }

        if (isValid) {
            // Имитация отправки данных
            simulateLogin(email, password);
        }
    });

    // Функция имитации входа
    function simulateLogin(email, password) {
        // Показываем состояние загрузки
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';

        // Подготавливаем данные для отправки
        const formData = {
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value
        };

        // Отправляем POST-запрос на сервер
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                document.getElementById('successMessage').style.display = 'block';
                document.getElementById('successMessage').textContent = 'Ошибка входа';
                document.getElementById('successMessage').style.backgroundColor = '#C41E3A';
                document.getElementById('successMessage').style.color = '#ffffff';
                throw new Error('Ошибка сети');
            }
            return response.json();
        })
        .then(data => {
            if (data.message == "True") {
                // Показываем сообщение об успехе
                document.getElementById('successMessage').style.display = 'block';
                document.getElementById('successMessage').textContent = 'Вход прошел успешно!';
                document.getElementById('successMessage').style.backgroundColor = '#d4edda';
                document.getElementById('successMessage').style.color = '#155724';

                // Очищаем форму
                document.getElementById('loginForm').reset();

                window.location.href="/account"
            } else {
                document.getElementById('successMessage').style.display = 'block';
                document.getElementById('successMessage').textContent = 'Ошибка входа';
                document.getElementById('successMessage').style.backgroundColor = '#C41E3A';
                document.getElementById('successMessage').style.color = '#ffffff';
                throw new Error('Ошибка регистрации');
            }
        })
        .finally(() => {
            // Восстанавливаем кнопку
            document.getElementById('loginBtn').disabled = false;
            document.getElementById('loginBtn').textContent = 'Войти';

            // Через 5 секунд скрываем сообщение
            setTimeout(() => {
                document.getElementById('successMessage').style.display = 'none';
            }, 5000);
        });
    }

    // Показать сообщение об успехе
    function showSuccessMessage() {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Успешный вход! Перенаправляем...</span>
        `;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // Показать сообщение об ошибке
    function showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message-global';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
    }

    // Социальные кнопки
    document.querySelector('.btn-google').addEventListener('click', function() {
        alert('Вход через Google - функция в разработке');
    });

    document.querySelector('.btn-vk').addEventListener('click', function() {
        alert('Вход через VK - функция в разработке');
    });

    // Восстановление сохраненных данных
    function restoreSavedData() {
        if (localStorage.getItem('rememberMe') === 'true') {
            const savedEmail = localStorage.getItem('userEmail');
            if (savedEmail) {
                emailInput.value = savedEmail;
                rememberMe.checked = true;
            }
        }
    }

    // CSS анимация для сообщений
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .success-message i,
        .error-message-global i {
            font-size: 18px;
        }
    `;
    document.head.appendChild(style);

    // Восстанавливаем сохраненные данные при загрузке
    restoreSavedData();

    // Дополнительная валидация при потере фокуса
    emailInput.addEventListener('blur', function() {
        if (this.value && !validateEmail(this.value)) {
            emailError.textContent = 'Введите корректный email адрес';
            this.style.borderColor = '#e74c3c';
        }
    });

    passwordInput.addEventListener('blur', function() {
        if (this.value && !validatePassword(this.value)) {
            passwordError.textContent = 'Пароль должен содержать минимум 6 символов';
            this.style.borderColor = '#e74c3c';
        }
    });
});