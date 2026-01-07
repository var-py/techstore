// Chat Bot Functionality
document.addEventListener('DOMContentLoaded', function() {
    const chatBtn = document.getElementById('chatBtn');
    const chatWindow = document.getElementById('chatWindow');
    const closeChat = document.getElementById('closeChat');
    const userInput = document.getElementById('userInput');
    const sendMessage = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');

    // Open chat window
    chatBtn.addEventListener('click', function() {
        chatWindow.style.display = 'flex';
    });

    // Close chat window
    closeChat.addEventListener('click', function() {
        chatWindow.style.display = 'none';
    });

    // Send message
    sendMessage.addEventListener('click', function() {
        if (userInput.value.trim() !== '') {
            addMessage(userInput.value, 'user');
            userInput.value = '';

            // Bot response after a short delay
            setTimeout(botResponse, 1000);
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