document.addEventListener('DOMContentLoaded', function() {
    // Элементы формы
    const recoveryForm = document.getElementById('recoveryForm');
    const emailInput = document.getElementById('email');
    const recoveryBtn = document.getElementById('recoveryBtn');
    const emailError = document.getElementById('emailError');

    // Элементы модального окна
    const successModal = document.getElementById('successModal');
    const userEmailSpan = document.getElementById('userEmail');
    const closeModal = document.getElementById('closeModal');
    const resendEmail = document.getElementById('resendEmail');

    // Переменные для хранения состояния
    let currentEmail = '';
    let isCodeSent = false;

    // Валидация email
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Валидация пароля
    function validatePassword(password) {
        return password.length >= 6;
    }

    // Валидация формы в реальном времени
    emailInput.addEventListener('input', function() {
        if (isCodeSent) return; // Не валидируем email после отправки кода

        if (!validateEmail(this.value)) {
            emailError.textContent = 'Введите корректный email адрес';
            this.style.borderColor = '#e74c3c';
        } else {
            emailError.textContent = '';
            this.style.borderColor = '#28a745';
        }
    });

    // Обработка отправки формы
    recoveryForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if (!isCodeSent) {
            // Первый этап: отправка кода на email
            const email = emailInput.value.trim();

            // Валидация email
            if (!validateEmail(email)) {
                emailError.textContent = 'Введите корректный email адрес';
                emailInput.style.borderColor = '#e74c3c';
                emailInput.focus();
                return;
            }

            // Отправка запроса на восстановление
            sendRecoveryEmail(email);
        } else {
            // Второй этап: проверка кода и установка нового пароля
            const code = emailInput.value.trim();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Валидация пароля
            if (!validatePassword(newPassword)) {
                showErrorMessage('Пароль должен содержать минимум 6 символов');
                return;
            }

            if (newPassword !== confirmPassword) {
                showErrorMessage('Пароли не совпадают');
                return;
            }

            // Проверка кода и установка нового пароля
            checkCodeAndSetPassword(code, newPassword);
        }
    });

    // Функция отправки email для восстановления
    async function sendRecoveryEmail(email) {
        recoveryBtn.disabled = true;
        recoveryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const url = `/forgot/password/email?email=${encodeURIComponent(email)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
                credentials: 'same-origin'
            });

            if (!response.ok) {
                let msg = '';
                try { msg = (await response.json())?.error || ''; } catch {}
                throw new Error(msg || 'Ошибка запроса');
            }

            const data = await response.json();
            const isOk = data?.message === true || data?.message === 'True';

            if (isOk) {
                currentEmail = email;
                isCodeSent = true;

                // Обновляем интерфейс для ввода кода
                updateUIForCodeInput();

                // Показываем модальное окно успеха
                showSuccessModal(email);
                saveSentEmail(email);
            } else {
                showErrorMessage(data?.error || 'Не удалось отправить код');
            }
        } catch (e) {
            const msg = /AbortError/i.test(String(e?.name))
                ? 'Время ожидания истекло'
                : (e?.message || 'Ошибка отправки');
            showErrorMessage(msg);
        } finally {
            clearTimeout(timeoutId);
            recoveryBtn.disabled = false;
            recoveryBtn.innerHTML = isCodeSent
                ? '<i class="fas fa-key"></i> Сменить пароль'
                : '<i class="fas fa-paper-plane"></i> Отправить код';
        }
    }

    // Функция проверки кода и установки нового пароля
    async function checkCodeAndSetPassword(code, newPassword) {
        recoveryBtn.disabled = true;
        recoveryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Смена пароля...';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const url = `/forgot/password/check/code?email=${encodeURIComponent(currentEmail)}&code=${encodeURIComponent(code)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
                credentials: 'same-origin'
            });

            if (!response.ok) {
                let msg = '';
                try { msg = (await response.json())?.error || ''; } catch {}
                throw new Error(msg || 'Ошибка проверки кода');
            }

            const data = await response.json();
            const isCodeValid = data?.message === true || data?.message === 'True';

            if (isCodeValid) {
                // Код верный, теперь меняем пароль
                await setNewPassword(newPassword);
            } else {
                showErrorMessage(data?.error || 'Неверный код подтверждения');
            }
        } catch (e) {
            const msg = /AbortError/i.test(String(e?.name))
                ? 'Время ожидания истекло'
                : (e?.message || 'Ошибка проверки кода');
            showErrorMessage(msg);
        } finally {
            clearTimeout(timeoutId);
            recoveryBtn.disabled = false;
            recoveryBtn.innerHTML = '<i class="fas fa-key"></i> Сменить пароль';
        }
    }

    // Функция установки нового пароля
    async function setNewPassword(newPassword) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const url = `/forgot/password/set`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    email: currentEmail,
                    newPassword: newPassword
                }),
                signal: controller.signal,
                credentials: 'same-origin'
            });

            if (!response.ok) {
                let msg = '';
                try { msg = (await response.json())?.error || ''; } catch {}
                throw new Error(msg || 'Ошибка смены пароля');
            }

            const data = await response.json();
            const isSuccess = data?.message === true || data?.message === 'True';

            if (isSuccess) {
                showSuccessMessage('Пароль успешно изменен!');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                showErrorMessage(data?.error || 'Не удалось сменить пароль');
            }
        } catch (e) {
            const msg = /AbortError/i.test(String(e?.name))
                ? 'Время ожидания истекло'
                : (e?.message || 'Ошибка смены пароля');
            showErrorMessage(msg);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Обновление интерфейса для ввода кода
    function updateUIForCodeInput() {
        // Обновляем заголовок
        document.querySelector('.recovery-header h1').textContent = 'Введите код подтверждения';
        document.querySelector('.recovery-header p').textContent = 'Мы отправили 6-значный код на вашу почту. Введите его ниже:';

        // Обновляем поле ввода
        const emailLabel = document.getElementById('email-label');
        const emailInputContainer = emailInput.parentElement;

        emailLabel.textContent = 'Код подтверждения';
        emailInput.placeholder = '000000';
        emailInput.value = '';
        emailInput.type = 'text';
        emailInput.maxLength = 6;

        // Добавляем поля для нового пароля
        const formGroup = document.querySelector('.form-group');

        // Создаем контейнер для полей пароля
        const passwordContainer = document.createElement('div');
        passwordContainer.className = 'password-fields';
        passwordContainer.innerHTML = `
            <div class="form-group">
                <label for="newPassword">Новый пароль</label>
                <div class="input-with-icon">
                    <i class="fas fa-lock"></i>
                    <input type="password" id="newPassword" name="newPassword" placeholder="Минимум 6 символов" required>
                </div>
                <div class="error-message" id="newPasswordError"></div>
            </div>
            <div class="form-group">
                <label for="confirmPassword">Подтвердите пароль</label>
                <div class="input-with-icon">
                    <i class="fas fa-lock"></i>
                    <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Повторите пароль" required>
                </div>
                <div class="error-message" id="confirmPasswordError"></div>
            </div>
        `;

        formGroup.parentNode.insertBefore(passwordContainer, formGroup.nextSibling);

        // Добавляем валидацию паролей
        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const newPasswordError = document.getElementById('newPasswordError');
        const confirmPasswordError = document.getElementById('confirmPasswordError');

        newPasswordInput.addEventListener('input', function() {
            validatePasswordFields(newPasswordInput, confirmPasswordInput, newPasswordError, confirmPasswordError);
        });

        confirmPasswordInput.addEventListener('input', function() {
            validatePasswordFields(newPasswordInput, confirmPasswordInput, newPasswordError, confirmPasswordError);
        });

        // Обновляем кнопку
        recoveryBtn.innerHTML = '<i class="fas fa-key"></i> Сменить пароль';


    }

    // Валидация полей пароля
    function validatePasswordFields(newPasswordInput, confirmPasswordInput, newPasswordError, confirmPasswordError) {
        const password = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Сбрасываем ошибки
        newPasswordError.textContent = '';
        confirmPasswordError.textContent = '';
        newPasswordInput.style.borderColor = '#e9ecef';
        confirmPasswordInput.style.borderColor = '#e9ecef';

        if (password && !validatePassword(password)) {
            newPasswordError.textContent = 'Пароль должен содержать минимум 6 символов';
            newPasswordInput.style.borderColor = '#e74c3c';
        }

        if (confirmPassword && password !== confirmPassword) {
            confirmPasswordError.textContent = 'Пароли не совпадают';
            confirmPasswordInput.style.borderColor = '#e74c3c';
        }

        if (password && validatePassword(password) && password === confirmPassword) {
            newPasswordInput.style.borderColor = '#28a745';
            confirmPasswordInput.style.borderColor = '#28a745';
        }
    }

    // Добавление кнопки "Вернуться к email"
    function addBackToEmailButton() {
        const backButton = document.createElement('button');
        backButton.type = 'button';
        backButton.className = 'btn btn-outline btn-back-to-email';
        backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Вернуться к email';
        backButton.style.marginRight = '10px';

        backButton.addEventListener('click', function() {
            resetToEmailInput();
        });

        recoveryBtn.parentNode.insertBefore(backButton, recoveryBtn);
    }

    // Сброс интерфейса к вводу email
    function resetToEmailInput() {
        isCodeSent = false;
        currentEmail = '';

        // Восстанавливаем оригинальный интерфейс
        document.querySelector('.recovery-header h1').textContent = 'Восстановление пароля';
        document.querySelector('.recovery-header p').textContent = 'Введите email вашего аккаунта, и мы вышлем вам инструкции для сброса пароля';

        const emailLabel = document.getElementById('email-label');
        emailLabel.textContent = 'Email адрес';
        emailInput.placeholder = 'your@email.com';
        emailInput.type = 'email';
        emailInput.value = '';
        emailInput.maxLength = null;

        // Удаляем поля пароля
        const passwordContainer = document.querySelector('.password-fields');
        if (passwordContainer) {
            passwordContainer.remove();
        }

        // Удаляем кнопку "Вернуться к email"
        const backButton = document.querySelector('.btn-back-to-email');
        if (backButton) {
            backButton.remove();
        }

        // Обновляем кнопку
        recoveryBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить код';

        // Сбрасываем стили
        emailInput.style.borderColor = '#e9ecef';
        emailError.textContent = '';
    }

    // Показать модальное окно успеха
    function showSuccessModal(email) {
        userEmailSpan.textContent = email;
        successModal.classList.add('show');
    }

    // Показать сообщение об успехе
    function showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message-global';
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
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
        }, 4000);
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

    // Сохранить отправленный email в localStorage
    function saveSentEmail(email) {
        const sentEmails = JSON.parse(localStorage.getItem('recoveryEmails') || '[]');
        const emailData = {
            email: email,
            timestamp: new Date().toISOString(),
            attempts: 1
        };

        const existingEmail = sentEmails.find(item => item.email === email);
        if (existingEmail) {
            existingEmail.timestamp = new Date().toISOString();
            existingEmail.attempts += 1;
        } else {
            sentEmails.push(emailData);
        }

        localStorage.setItem('recoveryEmails', JSON.stringify(sentEmails));
    }

    // Обработчики модального окна
    closeModal.addEventListener('click', function() {
        successModal.classList.remove('show');
    });

    resendEmail.addEventListener('click', function() {
        const email = userEmailSpan.textContent;
        successModal.classList.remove('show');
        sendRecoveryEmail(email);
    });

    // Закрыть модальное окно при клике вне его
    successModal.addEventListener('click', function(e) {
        if (e.target === successModal) {
            successModal.classList.remove('show');
        }
    });

    // Закрыть модальное окно при нажатии Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && successModal.classList.contains('show')) {
            successModal.classList.remove('show');
        }
    });

    // CSS анимации для уведомлений
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

        .error-message-global i,
        .success-message-global i {
            font-size: 18px;
        }

        .password-fields {
            margin-top: 20px;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .btn-back-to-email {
            margin-right: 10px;
        }
    `;
    document.head.appendChild(style);

    // Автофокус на поле ввода при загрузке
    emailInput.focus();
});