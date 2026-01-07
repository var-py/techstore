 // JavaScript для функциональности страницы
        document.addEventListener('DOMContentLoaded', function() {
            // Переключение изображений товара
            const thumbnails = document.querySelectorAll('.thumbnail');
            const mainImage = document.getElementById('mainImage');

            thumbnails.forEach(thumbnail => {
                thumbnail.addEventListener('click', function() {
                    // Убираем активный класс у всех миниатюр
                    thumbnails.forEach(t => t.classList.remove('active'));
                    // Добавляем активный класс к текущей миниатюре
                    this.classList.add('active');
                    // Меняем основное изображение
                    mainImage.src = this.getAttribute('data-image');
                });
            });

            // Управление количеством товара
            const quantityInput = document.getElementById('quantity');
            const decreaseBtn = document.getElementById('decrease');
            const increaseBtn = document.getElementById('increase');

            decreaseBtn.addEventListener('click', function() {
                let value = parseInt(quantityInput.value);
                if (value > 1) {
                    quantityInput.value = value - 1;
                }
            });

            increaseBtn.addEventListener('click', function() {
                let value = parseInt(quantityInput.value);
                quantityInput.value = value + 1;
            });

            // Переключение табов
            const tabHeaders = document.querySelectorAll('.tab-header');
            const tabPanes = document.querySelectorAll('.tab-pane');

            tabHeaders.forEach(header => {
                header.addEventListener('click', function() {
                    // Убираем активный класс у всех заголовков
                    tabHeaders.forEach(h => h.classList.remove('active'));
                    // Добавляем активный класс к текущему заголовку
                    this.classList.add('active');

                    // Скрываем все табы
                    tabPanes.forEach(pane => pane.classList.remove('active'));
                    // Показываем нужный таб
                    const tabId = this.getAttribute('data-tab');
                    document.getElementById(tabId).classList.add('active');
                });
            });

            // Добавление в корзину
            const addToCartBtn = document.querySelector('.add-to-cart');
            const cartCount = document.querySelector('.cart-count');

            addToCartBtn.addEventListener('click', function() {
                let count = parseInt(cartCount.textContent);
                let quantity = parseInt(quantityInput.value);
                cartCount.textContent = count + quantity;

                // Анимация добавления
                this.innerHTML = '<i class="fas fa-check"></i> Добавлено';
                this.style.background = '#4caf50';

                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-shopping-cart"></i> В корзину';
                    this.style.background = '#4a76a8';
                }, 2000);
            });
        });