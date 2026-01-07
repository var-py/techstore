document.getElementById('registrationForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // Сбрасываем предыдущие ошибки
    resetErrors();

    // Получаем значения полей
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    let isValid = true;

    // Валидация имени
    if (name == '') {
        showError('nameError', 'Пожалуйста, введите ваше имя');
        isValid = false;
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('emailError', 'Пожалуйста, введите корректный email');
        isValid = false;
    }

    // Валидация пароля
    if (password.length < 6) {
        showError('passwordError', 'Пароль должен содержать минимум 6 символов');
        isValid = false;
    }

    console.log(isValid);
    if (isValid) {
        // Отключаем кнопку отправки
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('submitBtn').textContent = 'Регистрация...';

        // Подготавливаем данные для отправки
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value
        };

        // Отправляем POST-запрос на сервер
        fetch('/registration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                document.getElementById('successMessage').style.display = 'block';
                document.getElementById('successMessage').textContent = 'Ошибка регистрации';
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
                document.getElementById('successMessage').textContent = 'Регистрация прошла успешно!';
                document.getElementById('successMessage').style.backgroundColor = '#d4edda';
                document.getElementById('successMessage').style.color = '#155724';

                // Очищаем форму
                document.getElementById('registrationForm').reset();

                window.location.href="/account"
            } else {
                document.getElementById('successMessage').style.display = 'block';
                document.getElementById('successMessage').textContent = 'Ошибка регистрации';
                document.getElementById('successMessage').style.backgroundColor = '#C41E3A';
                document.getElementById('successMessage').style.color = '#ffffff';
                throw new Error('Ошибка регистрации');
            }
        })
        .finally(() => {
            // Восстанавливаем кнопку
            document.getElementById('submitBtn').disabled = false;
            document.getElementById('submitBtn').textContent = 'Зарегистрироваться';

            // Через 5 секунд скрываем сообщение
            setTimeout(() => {
                document.getElementById('successMessage').style.display = 'none';
            }, 5000);
        });
    }
});

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function resetErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.style.display = 'none';
    });
}

// Реальная валидация при вводе
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        const errorId = this.id + 'Error';
        document.getElementById(errorId).style.display = 'none';
    });
});