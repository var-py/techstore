

const socket = io("http://localhost:80");
let products=[];
let currentChatUser = null;
let messages = []

document.addEventListener('DOMContentLoaded', function() {
    // Инициализация
    init();

    // Переменные
    products = JSON.parse(localStorage.getItem('adminProducts')) || [];
    let selectedProducts = new Set();
    messages = JSON.parse(localStorage.getItem('adminMessages')) || {};

    // Инициализация функций
    function init() {
        setupNavigation();
        setupDashboard();
        setupProductManagement();
        setupChatSupport();
        setupEventListeners();
        updateCurrentDate();
        loadProducts();
        loadChatUsers();
        initializeChart();
    }

    // Навигация по разделам
    function setupNavigation() {
        const menuLinks = document.querySelectorAll('.sidebar-menu a');
        const sections = document.querySelectorAll('.content-section');

        menuLinks.forEach(link => {
            link.addEventListener('click', function(e){
             if (this.getAttribute('href') === '/logout') {
                e.preventDefault();
                if (confirm('Вы уверены, что хотите выйти?')) {
                    window.location.href='/logout'
                }
                return;
            }


                // Убираем активный класс у всех пунктов
                menuLinks.forEach(item => item.classList.remove('active'));
                // Добавляем активный класс текущему пункту
                this.classList.add('active');

                // Получаем ID секции
                const sectionId = this.getAttribute('data-section') + '-section';

                // Скрываем все секции
                sections.forEach(section => section.classList.remove('active'));

                // Показываем выбранную секцию
                document.getElementById(sectionId).classList.add('active');

                // Особые действия для определенных секций
                if (sectionId === 'products-section') {
                    refreshProductsTable();
                } else if (sectionId === 'chat-section') {

                }
            });
        });

        // Кнопки перехода между секциями
        document.querySelectorAll('[data-section]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (this.dataset.section) {
                    e.preventDefault();
                    const target = document.querySelector(`[data-section="${this.dataset.section}"]`);
                    if (target) target.click();
                }
            });
        });
    }

    // Дашборд
    function setupDashboard() {
        // Обновление даты
        updateCurrentDate();

        // Инициализация графика
        initializeChart();
    }

    // Обновление текущей даты
    function updateCurrentDate() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        document.getElementById('currentDate').textContent =
            now.toLocaleDateString('ru-RU', options);
    }

    // Инициализация графика продаж
    function initializeChart() {
        const ctx = document.getElementById('salesChart').getContext('2d');

        // Данные для графика
        const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const salesData = [12000, 19000, 15000, 25000, 22000, 30000, 27000];

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Продажи (₽)',
                    data: salesData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₽' + value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                }
            }
        });
    }

    // Управление товарами
    function setupProductManagement() {
        // Загрузка существующих товаров
        loadProducts();

        // Drag and Drop для изображений
        setupImageUpload();

        // Динамические характеристики
        // setupSpecifications();

        // Обработка формы добавления товара
        document.getElementById('addProductForm').addEventListener('submit', handleAddProduct);

        // Предпросмотр товара
        document.getElementById('previewProduct').addEventListener('click', showProductPreview);

        // Выбор всех товаров
        document.getElementById('selectAll').addEventListener('change', toggleSelectAll);

        // Удаление выбранных товаров
        document.getElementById('deleteSelected').addEventListener('click', deleteSelectedProducts);

        // Поиск товаров
        document.querySelector('.search-box input').addEventListener('input', filterProducts);
    }

    // Загрузка товаров
    function loadProducts() {
        // Если нет товаров в localStorage, создаем демо-данные
        if (products.length === 0) {
            products = [
                {
                    id: 1,
                    sku: 'SKU-001',
                    name: 'Samsung Galaxy S23 Ultra',
                    category: 'smartphones',
                    brand: 'Samsung',
                    price: 89999,
                    discount: 5,
                    stock: 25,
                    description: 'Флагманский смартфон с мощным процессором и потрясающей камерой',
                    images: [],
                    specs: {
                        'Экран': '6.8" AMOLED',
                        'Процессор': 'Snapdragon 8 Gen 2',
                        'Память': '12/512 ГБ'
                    },
                    status: 'active',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 2,
                    sku: 'SKU-002',
                    name: 'iPhone 14 Pro',
                    category: 'smartphones',
                    brand: 'Apple',
                    price: 99999,
                    discount: 0,
                    stock: 15,
                    description: 'Премиальный смартфон от Apple с Dynamic Island',
                    images: [],
                    specs: {
                        'Экран': '6.1" Super Retina XDR',
                        'Процессор': 'A16 Bionic',
                        'Память': '6/256 ГБ'
                    },
                    status: 'active',
                    createdAt: new Date().toISOString()
                }
            ];
            saveProducts();
        }

        refreshProductsTable();
    }

    // Обновление таблицы товаров
    function refreshProductsTable() {
        const tableBody = document.getElementById('productsTableBody');
        tableBody.innerHTML = '';

        products.forEach((product, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" class="product-checkbox" data-id="${product.id}"></td>
                <td>${product.id}</td>
                <td class="product-image-cell">
                    <img src="https://via.placeholder.com/50x50/3498db/ffffff?text=${product.name.charAt(0)}" alt="${product.name}">
                </td>
                <td>${product.name}</td>
                <td><span class="category-badge">${getCategoryName(product.category)}</span></td>
                <td>
                    <strong>₽ ${product.price.toLocaleString()}</strong>
                    ${product.discount > 0 ? `<br><small class="discount-badge">-${product.discount}%</small>` : ''}
                </td>
                <td>
                    <span class="stock-badge ${product.stock > 10 ? 'in-stock' : 'low-stock'}">
                        ${product.stock} шт.
                    </span>
                </td>
                <td><span class="status-badge ${product.status}">${getStatusText(product.status)}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon edit-product" data-id="${product.id}" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-product" data-id="${product.id}" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn-icon view-product" data-id="${product.id}" title="Просмотреть">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Добавляем обработчики событий для чекбоксов
        document.querySelectorAll('.product-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const productId = parseInt(this.dataset.id);
                if (this.checked) {
                    selectedProducts.add(productId);
                } else {
                    selectedProducts.delete(productId);
                }
                updateSelectAllCheckbox();
            });
        });

        // Добавляем обработчики для кнопок действий
        document.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', function() {
                editProduct(parseInt(this.dataset.id));
            });
        });

        document.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteProduct(parseInt(this.dataset.id));
            });
        });
    }

    // Получение названия категории
    function getCategoryName(category) {
        const categories = {
            'smartphones': 'Смартфоны',
            'laptops': 'Ноутбуки',
            'tablets': 'Планшеты',
            'accessories': 'Аксессуары'
        };
        return categories[category] || category;
    }

    // Получение текста статуса
    function getStatusText(status) {
        const statuses = {
            'active': 'Активен',
            'inactive': 'Неактивен',
            'out_of_stock': 'Нет в наличии'
        };
        return statuses[status] || status;
    }

    // Настройка загрузки изображений
    function setupImageUpload() {
        const uploadArea = document.getElementById('imageUploadArea');
        const fileInput = document.getElementById('imageUpload');
        const browseBtn = document.getElementById('browseImages');
        const previewArea = document.getElementById('imagePreview');

        // Клик по области загрузки
        browseBtn.addEventListener('click', () => fileInput.click());

        // Выбор файлов
        fileInput.addEventListener('change', handleFileSelect);

        // Drag and Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight() {
            uploadArea.classList.add('dragover');
        }

        function unhighlight() {
            uploadArea.classList.remove('dragover');
        }

        uploadArea.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }

        function handleFileSelect(e) {
            const files = e.target.files;
            handleFiles(files);
        }

        function handleFiles(files) {
            [...files].forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        addImagePreview(e.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        function addImagePreview(src) {
            const preview = document.createElement('div');
            preview.className = 'preview-image';
            preview.innerHTML = `
                <img src="${src}" alt="Preview">
                <button class="remove-image" type="button">&times;</button>
            `;

            preview.querySelector('.remove-image').addEventListener('click', function() {
                preview.remove();
            });

            previewArea.appendChild(preview);
        }
    }

    // Настройка характеристик товара
    function setupSpecifications() {
        const addSpecBtn = document.getElementById('addSpec');
        const specsContainer = document.getElementById('specsContainer');

        addSpecBtn.addEventListener('click', function() {
            const specRow = document.createElement('div');
            specRow.className = 'spec-row';
            specRow.innerHTML = `
                <input type="text" class="spec-name" placeholder="Характеристика">
                <input type="text" class="spec-value" placeholder="Значение">
                <button type="button" class="btn-icon remove-spec"><i class="fas fa-times"></i></button>
            `;

            specRow.querySelector('.remove-spec').addEventListener('click', function() {
                specRow.remove();
            });

            specsContainer.appendChild(specRow);
        });

        // Удаление характеристик
        specsContainer.addEventListener('click', function(e) {
            if (e.target.closest('.remove-spec')) {
                e.target.closest('.spec-row').remove();
            }
        });
    }

    // Обработка добавления товара
    function handleAddProduct(e) {
        e.preventDefault();

        const product = {
            id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
            sku: document.getElementById('productSKU').value,
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            brand: document.getElementById('productBrand').value,
            price: parseFloat(document.getElementById('productPrice').value),
            discount: parseInt(document.getElementById('productDiscount').value) || 0,
            stock: parseInt(document.getElementById('productStock').value),
            description: document.getElementById('productDescription').value,
            images: getProductImages(),
            specs: getProductSpecs(),
            status: 'active',
            createdAt: new Date().toISOString()
        };

        // Валидация
        if (!validateProduct(product)) {
            return;
        }

        // Добавление товара
        products.push(product);
        saveProducts();

        // Очистка формы
        e.target.reset();
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('specsContainer').innerHTML = `
            <div class="spec-row">
                <input type="text" class="spec-name" placeholder="Характеристика">
                <input type="text" class="spec-value" placeholder="Значение">
                <button type="button" class="btn-icon remove-spec"><i class="fas fa-times"></i></button>
            </div>
        `;

        // Показать уведомление
        showNotification('Товар успешно добавлен!', 'success');

        // Перейти к списку товаров
        document.querySelector('[data-section="products"]').click();
    }

    // Получение изображений товара
    function getProductImages() {
        const images = [];
        document.querySelectorAll('.preview-image img').forEach(img => {
            images.push(img.src);
        });
        return images;
    }

    // Получение характеристик товара
    function getProductSpecs() {
        const specs = {};
        document.querySelectorAll('.spec-row').forEach(row => {
            const name = row.querySelector('.spec-name').value;
            const value = row.querySelector('.spec-value').value;
            if (name && value) {
                specs[name] = value;
            }
        });
        return specs;
    }

    // Валидация товара
    function validateProduct(product) {
        if (!product.name.trim()) {
            showNotification('Введите название товара', 'error');
            return false;
        }
        if (!product.sku.trim()) {
            showNotification('Введите артикул товара', 'error');
            return false;
        }
        if (!product.category) {
            showNotification('Выберите категорию товара', 'error');
            return false;
        }
        if (product.price <= 0) {
            showNotification('Введите корректную цену', 'error');
            return false;
        }
        if (product.stock < 0) {
            showNotification('Введите корректное количество', 'error');
            return false;
        }
        return true;
    }

    // Предпросмотр товара
    function showProductPreview() {
        const formData = getFormData();
        const modal = document.getElementById('previewModal');
        const content = document.getElementById('previewContent');

        content.innerHTML = `
            <div class="preview-container">
                <h4>${formData.name || 'Новый товар'}</h4>
                <p><strong>Артикул:</strong> ${formData.sku || '—'}</p>
                <p><strong>Категория:</strong> ${getCategoryName(formData.category) || '—'}</p>
                <p><strong>Бренд:</strong> ${formData.brand || '—'}</p>
                <p><strong>Цена:</strong> ₽ ${formData.price ? formData.price.toLocaleString() : '0'}</p>
                ${formData.discount ? `<p><strong>Скидка:</strong> ${formData.discount}%</p>` : ''}
                <p><strong>Количество:</strong> ${formData.stock || '0'} шт.</p>
                <p><strong>Описание:</strong><br>${formData.description || '—'}</p>

                ${Object.keys(formData.specs || {}).length > 0 ? `
                    <p><strong>Характеристики:</strong></p>
                    <ul class="preview-specs">
                        ${Object.entries(formData.specs).map(([key, value]) => `
                            <li><strong>${key}:</strong> ${value}</li>
                        `).join('')}
                    </ul>
                ` : ''}
            </div>
        `;

        modal.classList.add('show');
    }

    // Получение данных формы
    function getFormData() {
        return {
            name: document.getElementById('productName').value,
            sku: document.getElementById('productSKU').value,
            category: document.getElementById('productCategory').value,
            brand: document.getElementById('productBrand').value,
            price: parseFloat(document.getElementById('productPrice').value) || 0,
            discount: parseInt(document.getElementById('productDiscount').value) || 0,
            stock: parseInt(document.getElementById('productStock').value) || 0,
            description: document.getElementById('productDescription').value,
            specs: getProductSpecs()
        };
    }

    // Выбор всех товаров
    function toggleSelectAll(e) {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
            const productId = parseInt(checkbox.dataset.id);
            if (e.target.checked) {
                selectedProducts.add(productId);
            } else {
                selectedProducts.delete(productId);
            }
        });
    }

    // Обновление чекбокса "Выбрать все"
    function updateSelectAllCheckbox() {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        const selectAllCheckbox = document.getElementById('selectAll');

        const allChecked = checkboxes.length > 0 &&
                          Array.from(checkboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
    }

    // Удаление выбранных товаров
    function deleteSelectedProducts() {
        if (selectedProducts.size === 0) {
            showNotification('Выберите товары для удаления', 'warning');
            return;
        }

        if (confirm(`Удалить ${selectedProducts.size} товар(ов)?`)) {
            products = products.filter(product => !selectedProducts.has(product.id));
            selectedProducts.clear();
            saveProducts();
            refreshProductsTable();
            showNotification('Товары успешно удалены', 'success');
        }
    }

    // Удаление одного товара
    function deleteProduct(id) {
        if (confirm('Удалить этот товар?')) {
            products = products.filter(product => product.id !== id);
            selectedProducts.delete(id);
            saveProducts();
            refreshProductsTable();
            showNotification('Товар удален', 'success');
        }
    }

    // Редактирование товара
    function editProduct(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;

        // Заполняем форму данными товара
        document.getElementById('productName').value = product.name;
        document.getElementById('productSKU').value = product.sku;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productBrand').value = product.brand || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productDiscount').value = product.discount || '';
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productDescription').value = product.description;

        // Очищаем и заполняем характеристики
        const specsContainer = document.getElementById('specsContainer');
        specsContainer.innerHTML = '';

        Object.entries(product.specs || {}).forEach(([name, value]) => {
            const specRow = document.createElement('div');
            specRow.className = 'spec-row';
            specRow.innerHTML = `
                <input type="text" class="spec-name" value="${name}" placeholder="Характеристика">
                <input type="text" class="spec-value" value="${value}" placeholder="Значение">
                <button type="button" class="btn-icon remove-spec"><i class="fas fa-times"></i></button>
            `;

            specRow.querySelector('.remove-spec').addEventListener('click', function() {
                specRow.remove();
            });

            specsContainer.appendChild(specRow);
        });

        // Переходим к форме добавления товара
        document.querySelector('[data-section="add-product"]').click();

        showNotification('Редактирование товара', 'info');
    }

    // Фильтрация товаров
    function filterProducts(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#productsTableBody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    // Сохранение товаров в localStorage
    function saveProducts() {
        localStorage.setItem('adminProducts', JSON.stringify(products));
    }

    // Чат поддержки
    function setupChatSupport() {
        loadChatUsers();
        setupChatEventListeners();

    }

    // Загрузка пользователей чата
    function loadChatUsers() {
        let demoUsers = [];
        fetch('/api/users', {
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
          .then(users => {
            demoUsers = users;
            const usersList = document.getElementById('usersList');
            usersList.innerHTML = '';

            demoUsers.forEach(user => {
                const userElement = createUserElement(user);
                usersList.appendChild(userElement);
            });
            console.log(demoUsers)
          })
          .catch(error => {
            console.error(error);
          });


    }

    // Создание элемента пользователя
    function createUserElement(user) {
        const div = document.createElement('div');
        div.className = `user-item ${user.unread > 0 ? 'has-unread' : ''}`;
        div.dataset.userId = user.id;

        const lastSeen = new Date(user.lastSeen);
        const timeAgo = getTimeAgo(lastSeen);

        div.innerHTML = `
            <div class="user-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="user-details">
                <div class="user-name">${user.name}</div>
                <div class="user-last-message">${user.lastMessage}</div>
            </div>
            <div class="user-meta">
                <div class="user-time">${timeAgo}</div>
                ${user.unread > 0 ? `<div class="user-unread">${user.unread}</div>` : ''}
            </div>
        `;

        div.addEventListener('click', () => selectChatUser(user));

        return div;
    }

    // Форматирование времени "сколько времени назад"
    function getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин`;
        if (hours < 24) return `${hours} ч`;
        if (days < 7) return `${days} д`;

        return date.toLocaleDateString('ru-RU');
    }

    // Выбор пользователя для чата
    function selectChatUser(user) {
        currentChatUser = user;

        // Обновляем выделение
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-user-id="${user.id}"]`).classList.add('active');

        // Обновляем заголовок чата
        document.getElementById('currentUserName').textContent = user.name;
        document.getElementById('currentUserStatus').textContent =
            user.status === 'online' ? 'В сети' : 'Был(а) недавно';

        // Показываем поле ввода
        document.getElementById('chatInputArea').style.display = 'block';

        // Загружаем сообщения
        loadChatMessages(user.id);

        // Сбрасываем счетчик непрочитанных
        if (user.unread > 0) {
            user.unread = 0;
            updateUnreadCount();
            saveMessages();
        }
    }

    // Загрузка сообщений
    function loadChatMessages(userId) {
        const messagesContainer = document.getElementById('chatMessages');
        let massagesInChat = [];
        fetch(`/api/chat/${userId}`, {
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
            messagesContainer.innerHTML = '';
            // Добавляем сообщения
            massagesInChat.forEach(message => {
                const messageElement = createMessageElement(message);
                messagesContainer.appendChild(messageElement);
            });

            // Прокручиваем вниз
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          })
          .catch(error => {
            console.error(error);
          });

    }

    // Создание элемента сообщения
    function createMessageElement(message) {
        const div = document.createElement('div');
        div.className = `message ${message.sender === 'admin' ? 'outgoing' : 'incoming'}`;

        const time = new Date(message.time + 'Z');
        const timeString = time.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit'
        });

        div.innerHTML = `
            <div class="message-text">${message.text}</div>
            <div class="message-time">${timeString}</div>
        `;

        return div;
    }

    // Настройка обработчиков событий чата
    function setupChatEventListeners() {
        // Отправка сообщения
        const sendBtn = document.getElementById('sendMessage');
        const messageInput = document.getElementById('messageInput');

        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Автоматическое увеличение высоты текстового поля
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });

        // Поиск пользователей
        document.querySelector('.chat-search input').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const users = document.querySelectorAll('.user-item');

            users.forEach(user => {
                const userName = user.querySelector('.user-name').textContent.toLowerCase();
                user.style.display = userName.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Отправка сообщения
    function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();

        if (!text || !currentChatUser) return;

        // Создаем новое сообщение
        const newMessage = {
            id: Date.now(),
            text: text,
            sender: 'admin',
            time: new Date().toISOString()
        };

        // Добавляем сообщение в историю
        if (!messages[currentChatUser.id]) {
            messages[currentChatUser.id] = [];
        }
        messages[currentChatUser.id].push(newMessage);
        saveMessages();

        // Добавляем сообщение в чат
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = createMessageElement(newMessage);
        messagesContainer.appendChild(messageElement);

        // Очищаем поле ввода
        input.value = '';
        input.style.height = 'auto';

        // Прокручиваем вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

            const url = `/api/massages`;
            const response = fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    to_user: currentChatUser.id
                }),

                credentials: 'same-origin'
            });
        // Имитируем ответ пользователя через 1-3 секунды
        simulateUserResponse();
    }

    // Имитация ответа пользователя
    function simulateUserResponse() {
        if (!currentChatUser) return;

        const responses = [
            "Спасибо за информацию!",
            "Понятно, буду ждать",
            "Можно уточнить еще один момент?",
            "Отлично, это то что нужно",
            "Спасибо за помощь!"
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        setTimeout(() => {
            const responseMessage = {
                id: Date.now(),
                text: randomResponse,
                sender: 'user',
                time: new Date().toISOString()
            };

            messages[currentChatUser.id].push(responseMessage);
            saveMessages();

            const messagesContainer = document.getElementById('chatMessages');
            const messageElement = createMessageElement(responseMessage);
            messagesContainer.appendChild(messageElement);

            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // Обновляем счетчик непрочитанных
            currentChatUser.unread++;
            updateUnreadCount();

        }, 1000 + Math.random() * 2000);
    }

    // Обновление статуса онлайн


    // Обновление счетчика непрочитанных
    function updateUnreadCount() {
        const users = document.querySelectorAll('.user-item');
        let totalUnread = 0;

        users.forEach(user => {
            const unreadElement = user.querySelector('.user-unread');
            if (unreadElement) {
                totalUnread += parseInt(unreadElement.textContent);
            }
        });

        document.getElementById('unreadCount').textContent = totalUnread;
    }

    // Сохранение сообщений в localStorage
    function saveMessages() {
        localStorage.setItem('adminMessages', JSON.stringify(messages));
    }

    // Настройка общих обработчиков событий
    function setupEventListeners() {
        // Выход из системы
        document.getElementById('logoutBtn').addEventListener('click', function(e) {
            if (this.getAttribute('href') === '/logout') {
                e.preventDefault();
                if (confirm('Вы уверены, что хотите выйти?')) {
                    window.location.href='/logout'
                }
                return;
            }
        });

        // Закрытие модального окна
        document.getElementById('closePreview').addEventListener('click', function() {
            document.getElementById('previewModal').classList.remove('show');
        });

        // Закрытие модального окна при клике вне его
        document.getElementById('previewModal').addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
            }
        });

        // Закрытие модального окна по Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.getElementById('previewModal').classList.remove('show');
            }
        });
    }

    // Показать уведомление
    function showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Стили уведомления
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${getNotificationColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        // Анимация появления
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
        `;
        document.head.appendChild(style);

        // Кнопка закрытия
        notification.querySelector('.notification-close').addEventListener('click', function() {
            notification.remove();
        });

        // Добавляем уведомление на страницу
        document.body.appendChild(notification);

        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Получение иконки для уведомления
    function getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Получение цвета для уведомления
    function getNotificationColor(type) {
        const colors = {
            'success': '#27ae60',
            'error': '#e74c3c',
            'warning': '#f39c12',
            'info': '#3498db'
        };
        return colors[type] || '#3498db';
    }
});