

const socket = io()
document.addEventListener('DOMContentLoaded', function() {
    // Переключение между разделами
    const menuLinks = document.querySelectorAll('.sidebar-menu a');
    const sections = document.querySelectorAll('.content-section');
    socket.on("massage_touser", (data) => {
      console.log("Пришло сообщение:", data);

      const { user_id, text, time_send } = data;
      addMessage(text,"bot")
      console.log(user_id, text, time_send);
    });
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '/logout') {
                e.preventDefault();
                if (confirm('Вы уверены, что хотите выйти?')) {
                    window.location.href='/logout'
                }
                return;
            }

            e.preventDefault();

            // Убираем активный класс у всех пунктов меню
            menuLinks.forEach(item => item.classList.remove('active'));
            // Добавляем активный класс к текущему пункту меню
            this.classList.add('active');

            // Скрываем все секции
            sections.forEach(section => section.classList.remove('active'));

            // Показываем нужную секцию
            const sectionId = this.getAttribute('data-section') + '-section';
            document.getElementById(sectionId).classList.add('active');
        });
    });

    const sendMessage = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');

    // Open chat window
    chatBtn.addEventListener('click', function() {
            if (chatWindow.style.display=='flex'){
            chatWindow.style.display='none'}
            else {
             fetch(`/api/admin/chat`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              credentials: 'same-origin',
            })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Ошибка: ${response.status}`);
                }
                return response.json(); // ⏳ ждём парсинг
              })
              .then(massagesInChat => {
                // Очищаем контейнер
                chatMessages.innerHTML = '';
                // Добавляем сообщения
                massagesInChat.forEach(message => {
                    addMessage(message.text, message.sender);
                });
                chatWindow.style.display = 'flex';

                // Прокручиваем вниз
                chatMessages.scrollTop = chatMessages.scrollHeight;
              })
              .catch(error => {
                console.error(error);
              });
            }
    });

    // Close chat window
    closeChat.addEventListener('click', function() {
        chatWindow.style.display = 'none';
    });

    // Send message
    sendMessage.addEventListener('click', function() {
        if (userInput.value.trim() !== '') {
            addMessage(userInput.value, 'user');


            // Bot response after a short delay
            //setTimeout(botResponse, 1000);
             const url = `/api/admin/massages`;
            const response = fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    text: userInput.value
                }),

                credentials: 'same-origin'

            });
            userInput.value = '';
        }
    });

    // Send message on Enter key
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage.click();
        }
    });

    function addMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(sender + '-message');
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function botResponse() {
        const responses = [
            "Спасибо за ваш вопрос. Мы свяжемся с вами в ближайшее время.",
            "Интересный вопрос. Уточните, пожалуйста, о каком товаре идет речь?",
            "Для решения этого вопроса нам потребуется дополнительная информация.",
            "Наш специалист уже решает ваш вопрос. Ожидайте, пожалуйста.",
            "Благодарим за обращение! Чем еще могу помочь?"
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        addMessage(randomResponse, 'bot');
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    });
});
