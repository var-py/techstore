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

            // Покупка: количество учитывается, заказ сохраняется на сервере
            const buyNowBtn = document.querySelector('.buy-now');
            if (buyNowBtn) {
                buyNowBtn.addEventListener('click', function() {
                    const quantity = parseInt(quantityInput.value, 10) || 1;
                    window.location.href =
                        `/order/done?product_id=${this.dataset.productId}&qty=${quantity}`;
                });
            }

            // Избранное: кнопка синхронизирована с разделом «Избранное» кабинета
            const wishlistBtn = document.querySelector('.wishlist-btn');
            if (wishlistBtn) {
                const productId = Number(wishlistBtn.dataset.productId);

                const paintWishlist = (active) => {
                    wishlistBtn.dataset.active = active ? '1' : '0';
                    wishlistBtn.innerHTML = active
                        ? '<i class="fas fa-heart"></i> В избранном'
                        : '<i class="far fa-heart"></i> В избранное';
                };

                fetch('/api/account/favorites', {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'same-origin',
                })
                    .then((response) => (response.ok ? response.json() : []))
                    .then((favorites) => {
                        paintWishlist(favorites.some((item) => item.id === productId));
                    })
                    .catch(() => {});

                wishlistBtn.addEventListener('click', function() {
                    const active = this.dataset.active === '1';
                    const request = fetch(
                        active ? `/api/account/favorites/${productId}` : '/api/account/favorites',
                        {
                            method: active ? 'DELETE' : 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                            credentials: 'same-origin',
                            body: active ? undefined : JSON.stringify({ product_id: productId }),
                        }
                    );

                    request
                        .then((response) => {
                            if (response.status === 401) {
                                window.location.href = '/login';
                                return null;
                            }
                            return response.json();
                        })
                        .then((data) => {
                            if (!data) return;
                            if (data.error) {
                                alert(data.error);
                                return;
                            }
                            paintWishlist(!active);
                        })
                        .catch(() => alert('Не удалось обновить избранное'));
                });
            }
        });