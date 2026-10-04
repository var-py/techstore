/* ==========================================================================
   Личный кабинет: вся логика разделов.
   Данные берутся из /api/account/* (см. app/account_api.py).
   ========================================================================== */
(() => {
    'use strict';

    const API = '/api/account';

    const state = {
        user: null,
        stats: { orders: 0, favorites: 0, reviews: 0, addresses: 0, unread_messages: 0 },
        products: null,
        productsPromise: null,
        profileRequest: null,
        loaded: { profile: false, orders: false, addresses: false, favorites: false, reviews: false, settings: false },
        activeSection: 'profile',
        chatOpen: false,
    };

    /* ---------------------------------------------------------------------- */
    /* Утилиты                                                                */
    /* ---------------------------------------------------------------------- */
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseDate(value) {
        if (!value) return null;
        if (value instanceof Date) return value;
        let text = String(value).trim();
        if (!text) return null;
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) {
            text = text.replace(' ', 'T');
        }
        text = text.replace(/(\.\d{3})\d+/, '$1');
        const date = new Date(text);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        const date = parseDate(value);
        if (!date) return typeof value === 'string' && value ? value : '—';
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatDateTime(value) {
        const date = parseDate(value);
        if (!date) return '';
        return `${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }

    function formatTime(value) {
        const date = parseDate(value);
        if (!date) return '';
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    function formatMonthYear(value) {
        const date = parseDate(value);
        if (!date) return '—';
        return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    }

    function formatMoney(value) {
        const number = Number(value) || 0;
        return `${number.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
    }

    function plural(count, forms) {
        const number = Math.abs(Number(count) || 0) % 100;
        const last = number % 10;
        if (number > 10 && number < 20) return forms[2];
        if (last > 1 && last < 5) return forms[1];
        if (last === 1) return forms[0];
        return forms[2];
    }

    function initials(name) {
        const words = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return '??';
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    function setText(selector, value) {
        const node = $(selector);
        if (node) node.textContent = value;
    }

    function setBusy(button, busy) {
        if (!button) return;
        if (busy) {
            button.dataset.label = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Подождите…';
        } else {
            button.disabled = false;
            if (button.dataset.label) {
                button.innerHTML = button.dataset.label;
                delete button.dataset.label;
            }
        }
    }

    function skeletons(container, count = 2, className = 'skeleton') {
        container.innerHTML = new Array(count).fill(`<div class="${className}"></div>`).join('');
    }

    function emptyState(icon, title, text, actionHtml = '') {
        return `<div class="empty-state">
            <i class="fas ${icon}"></i>
            <div class="empty-title">${escapeHtml(title)}</div>
            <div class="empty-text">${escapeHtml(text)}</div>
            ${actionHtml}
        </div>`;
    }

    function starsDisplay(rating) {
        const value = Math.max(0, Math.min(5, Number(rating) || 0));
        let html = '<span class="stars-display">';
        for (let index = 1; index <= 5; index += 1) {
            html += `<i class="fas fa-star${index <= value ? '' : ' empty'}"></i>`;
        }
        return `${html}</span>`;
    }

    function thumb(photo, url) {
        const inner = photo
            ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" onerror="this.remove()">`
            : '<i class="fas fa-image"></i>';
        return `<a class="order-item-thumb" href="${escapeHtml(url)}">${inner}</a>`;
    }

    /* ---------------------------------------------------------------------- */
    /* Уведомления                                                            */
    /* ---------------------------------------------------------------------- */
    function toast(message, kind = 'info') {
        const stack = $('#toastStack');
        if (!stack) return;
        const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
        const node = document.createElement('div');
        node.className = `toast ${kind}`;
        node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        node.innerHTML = `<i class="fas ${icons[kind] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
        stack.appendChild(node);
        setTimeout(() => {
            node.classList.add('leaving');
            setTimeout(() => node.remove(), 260);
        }, kind === 'error' ? 5200 : 3200);
    }

    /* ---------------------------------------------------------------------- */
    /* Запросы к API                                                          */
    /* ---------------------------------------------------------------------- */
    async function api(path, options = {}) {
        const config = { credentials: 'same-origin', headers: { Accept: 'application/json' }, ...options };
        if (config.body !== undefined && typeof config.body !== 'string') {
            config.headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(config.body);
        }

        let response;
        try {
            response = await fetch(path, config);
        } catch (error) {
            throw new Error('Нет связи с сервером. Проверьте подключение.');
        }

        if (response.status === 401) {
            window.location.href = '/login';
            throw new Error('Требуется авторизация');
        }

        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (error) {
                data = null;
            }
        }

        if (!response.ok) {
            throw new Error((data && data.error) || `Не удалось выполнить запрос (${response.status})`);
        }
        return data;
    }

    /* ---------------------------------------------------------------------- */
    /* Профиль шапки и статистика                                             */
    /* ---------------------------------------------------------------------- */
    function applyUser(user) {
        if (!user) return;
        state.user = user;
        const ini = initials(user.name);
        setText('#headerName', user.name);
        setText('#sidebarName', user.name);
        setText('#sidebarEmail', user.email);
        setText('#headerAvatar', ini);
        setText('#sidebarAvatar', ini);
        setText('#sidebarSince', formatMonthYear(user.created_at));
        setText('#profileCreatedAt', formatDate(user.created_at));

        const nameInput = $('#profileName');
        const emailInput = $('#profileEmail');
        if (nameInput) nameInput.value = user.name;
        if (emailInput) emailInput.value = user.email;
    }

    function applyStats(stats) {
        if (!stats) return;
        state.stats = Object.assign({}, state.stats, stats);
        $$('[data-stat]').forEach((node) => {
            const key = node.dataset.stat;
            node.textContent = state.stats[key] ?? 0;
        });
        [['#badgeOrders', 'orders'], ['#badgeAddresses', 'addresses'],
         ['#badgeFavorites', 'favorites'], ['#badgeReviews', 'reviews']].forEach(([selector, key]) => {
            const badge = $(selector);
            if (!badge) return;
            const value = Number(state.stats[key]) || 0;
            badge.textContent = value;
            badge.hidden = value === 0;
        });
        updateChatBadge(state.stats.unread_messages);
    }

    async function loadProfile() {
        // Дедупликация: шапка, бейджи и раздел «Личные данные» используют один запрос.
        if (state.profileRequest) return state.profileRequest;
        state.profileRequest = (async () => {
            try {
                const data = await api(`${API}/profile`);
                applyUser(data.user);
                applyStats(data.stats);
                state.loaded.profile = true;
            } catch (error) {
                toast(error.message, 'error');
            }
        })();
        try {
            return await state.profileRequest;
        } finally {
            state.profileRequest = null;
        }
    }

    async function refreshStats() {
        try {
            const data = await api(`${API}/profile`);
            applyUser(data.user);
            applyStats(data.stats);
        } catch (error) {
            /* статистику обновляем «мягко»: ошибку не показываем */
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Навигация по разделам                                                  */
    /* ---------------------------------------------------------------------- */
    const loaders = {
        profile: () => loadProfile(),
        orders: () => loadOrders(),
        addresses: () => loadAddresses(),
        favorites: () => loadFavorites(),
        reviews: () => loadReviews(),
        settings: () => loadSettings(),
    };

    function goTo(section, options = {}) {
        if (!loaders[section]) section = 'profile';
        state.activeSection = section;

        $$('.nav-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.section === section);
        });
        $$('.section').forEach((node) => {
            node.classList.toggle('active', node.id === `section-${section}`);
        });

        if (window.location.hash !== `#${section}`) {
            history.replaceState(null, '', `#${section}`);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (!state.loaded[section] || options.force) {
            loaders[section]();
        }
    }

    function initNavigation() {
        $$('.nav-item').forEach((item) => {
            item.addEventListener('click', () => goTo(item.dataset.section));
        });
        $$('[data-goto]').forEach((item) => {
            item.addEventListener('click', () => goTo(item.dataset.goto));
        });

        const initial = (window.location.hash || '').replace('#', '');
        goTo(loaders[initial] ? initial : 'profile', { force: true });
    }

    /* ---------------------------------------------------------------------- */
    /* Личные данные                                                          */
    /* ---------------------------------------------------------------------- */
    function initProfileForm() {
        const form = $('#profileForm');
        if (!form) return;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = $('#profileName').value.trim();
            const email = $('#profileEmail').value.trim();
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

            if (!name) return toast('Укажите имя', 'error');
            if (!emailValid) return toast('Укажите корректный email', 'error');

            const button = $('button[type="submit"]', form);
            setBusy(button, true);
            try {
                const data = await api(`${API}/profile`, { method: 'PUT', body: { name, email } });
                applyUser(data.user);
                applyStats(data.stats);
                toast('Изменения сохранены', 'success');
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                setBusy(button, false);
            }
        });

        $('#profileReset').addEventListener('click', () => {
            if (state.user) applyUser(state.user);
            toast('Изменения отменены', 'info');
        });
    }

    /* ---------------------------------------------------------------------- */
    /* Заказы                                                                 */
    /* ---------------------------------------------------------------------- */
    function renderOrders(orders) {
        const list = $('#ordersList');
        if (!orders.length) {
            list.innerHTML = emptyState(
                'fa-box-open',
                'Заказов пока нет',
                'Оформите первый заказ — и он появится здесь вместе со статусом доставки.',
                '<a class="btn btn-primary" href="/store"><i class="fas fa-store"></i> Перейти в каталог</a>'
            );
            return;
        }

        list.innerHTML = orders.map((order) => {
            const items = order.items.map((item) => `
                <div class="order-item">
                    ${thumb(item.photo, item.url)}
                    <div class="order-item-body">
                        <a class="order-item-title" href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>
                        <div class="order-item-meta">${item.qty} шт. × ${formatMoney(item.price)}</div>
                    </div>
                    <div class="order-item-sum">${formatMoney(item.sum)}</div>
                </div>`).join('');

            const address = order.address
                ? `<div class="order-address"><i class="fas fa-location-dot"></i> ${escapeHtml(order.address.full)}</div>`
                : '';

            return `<article class="order-card" data-order="${order.id}">
                <div class="order-header">
                    <div class="order-id">
                        <span class="order-number">Заказ №${escapeHtml(order.number)}</span>
                        <span class="order-date">от ${formatDate(order.created_at)}</span>
                    </div>
                    <span class="order-status status-${escapeHtml(order.status_kind)}">${escapeHtml(order.status_label)}</span>
                </div>
                <div class="order-items">${items || '<div class="order-item-meta">Состав заказа недоступен</div>'}</div>
                <div class="order-footer">
                    <div class="order-total">
                        ${order.items_count} ${plural(order.items_count, ['товар', 'товара', 'товаров'])} на сумму
                        <strong>${formatMoney(order.total)}</strong>
                    </div>
                    <button type="button" class="btn btn-ghost btn-sm" data-repeat="${order.id}">
                        <i class="fas fa-arrows-rotate"></i> Повторить заказ
                    </button>
                </div>
                ${address}
            </article>`;
        }).join('');

        $$('[data-repeat]', list).forEach((button) => {
            button.addEventListener('click', async () => {
                setBusy(button, true);
                try {
                    await api(`${API}/orders/${button.dataset.repeat}/repeat`, { method: 'POST' });
                    toast('Заказ повторён', 'success');
                    state.loaded.orders = false;
                    await loadOrders({ force: true });
                    refreshStats();
                } catch (error) {
                    toast(error.message, 'error');
                } finally {
                    setBusy(button, false);
                }
            });
        });
    }

    async function loadOrders(options = {}) {
        const list = $('#ordersList');
        if (!state.loaded.orders || options.force) skeletons(list, 2, 'skeleton card-skeleton');
        try {
            const orders = await api(`${API}/orders`);
            state.loaded.orders = true;
            renderOrders(orders);
        } catch (error) {
            list.innerHTML = emptyState('fa-triangle-exclamation', 'Не удалось загрузить заказы', error.message);
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Адреса доставки                                                        */
    /* ---------------------------------------------------------------------- */
    function renderAddresses(addresses) {
        const list = $('#addressesList');
        if (!addresses.length) {
            list.innerHTML = emptyState(
                'fa-map-location-dot',
                'Адресов пока нет',
                'Добавьте адрес доставки — он подставится при оформлении заказа.',
                '<button type="button" class="btn btn-primary" data-action="add-address"><i class="fas fa-plus"></i> Добавить адрес</button>'
            );
            const button = $('[data-action="add-address"]', list);
            if (button) button.addEventListener('click', () => showAddressForm());
            return;
        }

        list.innerHTML = addresses.map((address) => `
            <article class="address-card${address.is_default ? ' is-default' : ''}" data-address="${address.id}">
                <div class="address-main">
                    <div class="address-top">
                        <span class="address-recipient">${escapeHtml(address.recipient)}</span>
                        <span class="address-phone">${escapeHtml(address.phone)}</span>
                        ${address.is_default ? '<span class="chip-default">По умолчанию</span>' : ''}
                    </div>
                    <div class="address-line">
                        ${escapeHtml(address.postcode ? `${address.postcode}, ` : '')}${escapeHtml(address.full)}
                    </div>
                    ${address.comment ? `<div class="address-comment"><i class="fas fa-comment-dots"></i> ${escapeHtml(address.comment)}</div>` : ''}
                </div>
                <div class="address-actions">
                    ${address.is_default ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-default="${address.id}"><i class="fas fa-check"></i> По умолчанию</button>`}
                    <button type="button" class="btn btn-ghost btn-sm" data-edit="${address.id}"><i class="fas fa-pen"></i> Изменить</button>
                    <button type="button" class="icon-btn danger" data-delete="${address.id}" aria-label="Удалить адрес"><i class="fas fa-trash"></i></button>
                </div>
            </article>`).join('');

        $$('[data-default]', list).forEach((button) => button.addEventListener('click', () => setDefaultAddress(button.dataset.default)));
        $$('[data-edit]', list).forEach((button) => button.addEventListener('click', () => showAddressForm(button.dataset.edit)));
        $$('[data-delete]', list).forEach((button) => button.addEventListener('click', () => removeAddress(button.dataset.delete)));
    }

    async function loadAddresses() {
        const list = $('#addressesList');
        if (!state.loaded.addresses) skeletons(list, 2, 'skeleton card-skeleton');
        try {
            const addresses = await api(`${API}/addresses`);
            state.addresses = addresses;
            state.loaded.addresses = true;
            renderAddresses(addresses);
        } catch (error) {
            list.innerHTML = emptyState('fa-triangle-exclamation', 'Не удалось загрузить адреса', error.message);
        }
    }

    function showAddressForm(addressId) {
        const form = $('#addressForm');
        const address = (state.addresses || []).find((item) => String(item.id) === String(addressId));
        form.classList.remove('hidden');
        $('#addressId').value = address ? address.id : '';
        $('#addressFormTitle').textContent = address ? 'Изменить адрес' : 'Новый адрес';
        $('#addressRecipient').value = address ? address.recipient : (state.user ? state.user.name : '');
        $('#addressPhone').value = address ? address.phone : '';
        $('#addressCity').value = address ? address.city : '';
        $('#addressStreet').value = address ? address.street : '';
        $('#addressHouse').value = address ? address.house : '';
        $('#addressApartment').value = address ? address.apartment : '';
        $('#addressPostcode').value = address ? address.postcode : '';
        $('#addressComment').value = address ? address.comment : '';
        $('#addressIsDefault').checked = address ? address.is_default : !(state.addresses || []).length;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('#addressRecipient').focus({ preventScroll: true });
    }

    function hideAddressForm() {
        $('#addressForm').classList.add('hidden');
        $('#addressForm').reset();
        $('#addressId').value = '';
    }

    async function setDefaultAddress(addressId) {
        try {
            await api(`${API}/addresses/${addressId}/default`, { method: 'POST' });
            toast('Адрес по умолчанию обновлён', 'success');
            await loadAddresses();
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    async function removeAddress(addressId) {
        if (!window.confirm('Удалить этот адрес доставки?')) return;
        try {
            await api(`${API}/addresses/${addressId}`, { method: 'DELETE' });
            toast('Адрес удалён', 'success');
            await loadAddresses();
            refreshStats();
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    function initAddressForm() {
        const form = $('#addressForm');
        if (!form) return;

        $('#addressAddBtn').addEventListener('click', () => showAddressForm());
        $('#addressCancelBtn').addEventListener('click', hideAddressForm);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const addressId = $('#addressId').value;
            const body = {
                recipient: $('#addressRecipient').value.trim(),
                phone: $('#addressPhone').value.trim(),
                city: $('#addressCity').value.trim(),
                street: $('#addressStreet').value.trim(),
                house: $('#addressHouse').value.trim(),
                apartment: $('#addressApartment').value.trim(),
                postcode: $('#addressPostcode').value.trim(),
                comment: $('#addressComment').value.trim(),
                is_default: $('#addressIsDefault').checked,
            };

            const missing = ['recipient', 'phone', 'city', 'street', 'house'].filter((field) => !body[field]);
            if (missing.length) return toast('Заполните получателя, телефон, город, улицу и дом', 'error');

            const button = $('button[type="submit"]', form);
            setBusy(button, true);
            try {
                if (addressId) {
                    await api(`${API}/addresses/${addressId}`, { method: 'PUT', body });
                    toast('Адрес обновлён', 'success');
                } else {
                    await api(`${API}/addresses`, { method: 'POST', body });
                    toast('Адрес добавлен', 'success');
                }
                hideAddressForm();
                await loadAddresses();
                refreshStats();
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                setBusy(button, false);
            }
        });
    }

    /* ---------------------------------------------------------------------- */
    /* Избранное                                                              */
    /* ---------------------------------------------------------------------- */
    function renderFavorites(favorites) {
        const list = $('#favoritesList');
        if (!favorites.length) {
            list.innerHTML = emptyState(
                'fa-heart',
                'В избранном пусто',
                'Отмечайте товары сердечком в каталоге — они появятся в этом разделе.',
                '<a class="btn btn-primary" href="/store"><i class="fas fa-store"></i> Перейти в каталог</a>'
            );
            return;
        }

        list.innerHTML = favorites.map((product) => `
            <article class="product-card" data-product="${product.id}">
                <div class="product-thumb">
                    ${product.photo ? `<img src="${escapeHtml(product.photo)}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.remove()">` : '<i class="fas fa-image"></i>'}
                    <button type="button" class="product-remove" data-remove="${product.id}" aria-label="Убрать из избранного">
                        <i class="fas fa-heart-crack"></i>
                    </button>
                </div>
                <div class="product-body">
                    ${product.brand ? `<span class="product-brand">${escapeHtml(product.brand)}</span>` : ''}
                    <a class="product-title" href="${escapeHtml(product.url)}">${escapeHtml(product.title)}</a>
                    <span class="product-category">${escapeHtml(product.category || 'Без категории')}</span>
                    <span class="product-price">${formatMoney(product.price)}</span>
                    <div class="product-actions">
                        <button type="button" class="btn btn-primary btn-sm" data-buy="${product.id}">
                            <i class="fas fa-bolt"></i> Купить
                        </button>
                    </div>
                </div>
            </article>`).join('');

        $$('[data-remove]', list).forEach((button) => {
            button.addEventListener('click', async () => {
                try {
                    await api(`${API}/favorites/${button.dataset.remove}`, { method: 'DELETE' });
                    toast('Товар убран из избранного', 'success');
                    await loadFavorites();
                    refreshStats();
                } catch (error) {
                    toast(error.message, 'error');
                }
            });
        });

        $$('[data-buy]', list).forEach((button) => {
            button.addEventListener('click', async () => {
                setBusy(button, true);
                try {
                    await api(`${API}/orders`, { method: 'POST', body: { product_id: Number(button.dataset.buy), qty: 1 } });
                    toast('Заказ оформлен — смотрите раздел «Мои заказы»', 'success');
                    state.loaded.orders = false;
                    refreshStats();
                } catch (error) {
                    toast(error.message, 'error');
                } finally {
                    setBusy(button, false);
                }
            });
        });
    }

    async function loadFavorites() {
        const list = $('#favoritesList');
        if (!state.loaded.favorites) skeletons(list, 3, 'skeleton card-skeleton');
        try {
            const favorites = await api(`${API}/favorites`);
            state.favorites = favorites;
            state.loaded.favorites = true;
            renderFavorites(favorites);
        } catch (error) {
            list.innerHTML = emptyState('fa-triangle-exclamation', 'Не удалось загрузить избранное', error.message);
        }
    }

    async function loadProducts() {
        if (state.products) return state.products;
        if (!state.productsPromise) {
            state.productsPromise = api(`${API}/products`).then((products) => {
                state.products = products;
                return products;
            }).catch((error) => {
                state.productsPromise = null;
                throw error;
            });
        }
        return state.productsPromise;
    }

    async function fillProductSelect(select, placeholder) {
        if (!select || select.dataset.filled === 'loading' || select.dataset.filled === '1') return;
        select.dataset.filled = 'loading';
        try {
            const products = await loadProducts();
            select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` +
                products.map((product) => `<option value="${product.id}">${escapeHtml(product.title)}${product.price ? ` — ${formatMoney(product.price)}` : ''}</option>`).join('');
            select.dataset.filled = '1';
        } catch (error) {
            select.innerHTML = '<option value="">Не удалось загрузить товары</option>';
            delete select.dataset.filled;
        }
    }

    function initFavorites() {
        const addButton = $('#favoriteAddBtn');
        const select = $('#favoriteProductSelect');
        if (!addButton || !select) return;

        fillProductSelect(select, 'Выберите товар из каталога');

        addButton.addEventListener('click', async () => {
            const productId = Number(select.value);
            if (!productId) return toast('Сначала выберите товар', 'error');
            setBusy(addButton, true);
            try {
                const result = await api(`${API}/favorites`, { method: 'POST', body: { product_id: productId } });
                toast(result.message || 'Товар добавлен в избранное', 'success');
                await loadFavorites();
                refreshStats();
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                setBusy(addButton, false);
            }
        });
    }

    /* ---------------------------------------------------------------------- */
    /* Отзывы                                                                 */
    /* ---------------------------------------------------------------------- */
    function renderReviews(reviews) {
        const list = $('#reviewsList');
        if (!reviews.length) {
            list.innerHTML = emptyState(
                'fa-star',
                'Отзывов пока нет',
                'Расскажите о покупке — это помогает другим покупателям с выбором.',
                '<button type="button" class="btn btn-primary" data-action="add-review"><i class="fas fa-pen"></i> Написать отзыв</button>'
            );
            const button = $('[data-action="add-review"]', list);
            if (button) button.addEventListener('click', () => showReviewForm());
            return;
        }

        list.innerHTML = reviews.map((review) => `
            <article class="review-card" data-review="${review.id}">
                <div class="review-head">
                    <a class="review-thumb" href="${escapeHtml(review.url)}">
                        ${review.product_photo ? `<img src="${escapeHtml(review.product_photo)}" alt="" loading="lazy" onerror="this.remove()">` : '<i class="fas fa-image"></i>'}
                    </a>
                    <div class="review-meta">
                        <a class="review-product" href="${escapeHtml(review.url)}">${escapeHtml(review.product_title)}</a>
                        <div class="review-sub">
                            ${starsDisplay(review.rating)}
                            <span>${escapeHtml(String(review.rating))} из 5</span>
                            <span>· ${formatDate(review.created_at)}</span>
                            ${review.updated_at ? '<span>· изменён</span>' : ''}
                        </div>
                    </div>
                </div>
                <p class="review-text">${escapeHtml(review.text)}</p>
                <div class="review-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-edit="${review.id}"><i class="fas fa-pen"></i> Изменить</button>
                    <button type="button" class="icon-btn danger" data-delete="${review.id}" aria-label="Удалить отзыв"><i class="fas fa-trash"></i></button>
                </div>
            </article>`).join('');

        $$('[data-edit]', list).forEach((button) => {
            button.addEventListener('click', () => {
                const review = (state.reviews || []).find((item) => String(item.id) === String(button.dataset.edit));
                if (review) showReviewForm(review);
            });
        });

        $$('[data-delete]', list).forEach((button) => {
            button.addEventListener('click', async () => {
                if (!window.confirm('Удалить отзыв?')) return;
                try {
                    await api(`${API}/reviews/${button.dataset.delete}`, { method: 'DELETE' });
                    toast('Отзыв удалён', 'success');
                    await loadReviews();
                    refreshStats();
                } catch (error) {
                    toast(error.message, 'error');
                }
            });
        });
    }

    async function loadReviews() {
        const list = $('#reviewsList');
        if (!state.loaded.reviews) skeletons(list, 2, 'skeleton card-skeleton');
        try {
            const reviews = await api(`${API}/reviews`);
            state.reviews = reviews;
            state.loaded.reviews = true;
            renderReviews(reviews);
        } catch (error) {
            list.innerHTML = emptyState('fa-triangle-exclamation', 'Не удалось загрузить отзывы', error.message);
        }
    }

    function setStars(rating) {
        $$('#reviewStars label').forEach((label, index) => {
            label.classList.toggle('on', index < Number(rating));
        });
    }

    function selectedRating() {
        const checked = $('#reviewStars input:checked');
        return checked ? Number(checked.value) : 5;
    }

    function showReviewForm(review) {
        const form = $('#reviewForm');
        form.classList.remove('hidden');
        $('#reviewId').value = review ? review.id : '';
        $('#reviewFormTitle').textContent = review ? 'Изменить отзыв' : 'Новый отзыв';
        $('#reviewText').value = review ? review.text : '';

        const select = $('#reviewProduct');
        if (review) {
            if (!$$('option', select).some((option) => String(option.value) === String(review.product_id))) {
                select.insertAdjacentHTML('beforeend', `<option value="${review.product_id}">${escapeHtml(review.product_title)}</option>`);
            }
            select.value = String(review.product_id);
            select.disabled = true;
        } else {
            select.disabled = false;
            fillProductSelect(select, 'Выберите товар');
        }

        const rating = review ? review.rating : 5;
        const radio = $(`#reviewStars input[value="${rating}"]`);
        if (radio) radio.checked = true;
        setStars(rating);

        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideReviewForm() {
        const form = $('#reviewForm');
        form.classList.add('hidden');
        form.reset();
        $('#reviewId').value = '';
        $('#reviewProduct').disabled = false;
        $('#reviewStars input[value="5"]').checked = true;
        setStars(5);
    }

    function initReviewForm() {
        const form = $('#reviewForm');
        if (!form) return;

        $('#reviewAddBtn').addEventListener('click', () => showReviewForm());
        $('#reviewCancelBtn').addEventListener('click', hideReviewForm);

        $$('#reviewStars input').forEach((input) => {
            input.addEventListener('change', () => setStars(selectedRating()));
        });
        setStars(selectedRating());

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const reviewId = $('#reviewId').value;
            const body = {
                product_id: Number($('#reviewProduct').value),
                rating: selectedRating(),
                text: $('#reviewText').value.trim(),
            };

            if (!body.product_id) return toast('Выберите товар', 'error');
            if (body.text.length < 5) return toast('Напишите отзыв (минимум 5 символов)', 'error');

            const button = $('button[type="submit"]', form);
            setBusy(button, true);
            try {
                if (reviewId) {
                    await api(`${API}/reviews/${reviewId}`, { method: 'PUT', body });
                    toast('Отзыв обновлён', 'success');
                } else {
                    await api(`${API}/reviews`, { method: 'POST', body });
                    toast('Спасибо за отзыв!', 'success');
                }
                hideReviewForm();
                await loadReviews();
                refreshStats();
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                setBusy(button, false);
            }
        });
    }

    /* ---------------------------------------------------------------------- */
    /* Настройки                                                              */
    /* ---------------------------------------------------------------------- */
    async function loadSettings() {
        try {
            const settings = await api(`${API}/settings`);
            $('#notifyOrders').checked = Boolean(settings.notify_orders);
            $('#notifyPromo').checked = Boolean(settings.notify_promo);
            state.loaded.settings = true;
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    function initSettings() {
        const toggles = [['#notifyOrders', 'notify_orders'], ['#notifyPromo', 'notify_promo']];
        toggles.forEach(([selector, key]) => {
            const input = $(selector);
            if (!input) return;
            input.addEventListener('change', async () => {
                try {
                    await api(`${API}/settings`, { method: 'PUT', body: { [key]: input.checked } });
                    toast('Настройки сохранены', 'success');
                } catch (error) {
                    input.checked = !input.checked;
                    toast(error.message, 'error');
                }
            });
        });

        const form = $('#passwordForm');
        if (!form) return;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const current = $('#currentPassword').value;
            const next = $('#newPassword').value;
            const confirm = $('#confirmPassword').value;

            if (!current) return toast('Введите текущий пароль', 'error');
            if (next.length < 6) return toast('Новый пароль должен быть не короче 6 символов', 'error');
            if (next !== confirm) return toast('Пароли не совпадают', 'error');

            const button = $('button[type="submit"]', form);
            setBusy(button, true);
            try {
                const result = await api(`${API}/password`, {
                    method: 'POST',
                    body: { current_password: current, new_password: next, confirm_password: confirm },
                });
                toast(result.message || 'Пароль изменён', 'success');
                form.reset();
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                setBusy(button, false);
            }
        });
    }

    function initLogout() {
        const logout = () => {
            if (window.confirm('Вы уверены, что хотите выйти?')) {
                window.location.href = '/logout';
            }
        };
        ['#logoutBtn', '#logoutBtnSettings'].forEach((selector) => {
            const button = $(selector);
            if (button) button.addEventListener('click', logout);
        });
    }

    /* ---------------------------------------------------------------------- */
    /* Чат с поддержкой                                                       */
    /* ---------------------------------------------------------------------- */
    function updateChatBadge(count) {
        const badge = $('#chatBadge');
        if (!badge) return;
        const value = Number(count) || 0;
        badge.textContent = value > 9 ? '9+' : value;
        badge.hidden = value === 0;
    }

    function addChatMessage(text, sender, time) {
        const container = $('#chatMessages');
        const node = document.createElement('div');
        node.className = `message ${sender}-message`;
        node.innerHTML = `${escapeHtml(text)}${time ? `<span class="message-time">${escapeHtml(formatTime(time))}</span>` : ''}`;
        container.appendChild(node);
        container.scrollTop = container.scrollHeight;
    }

    function renderChatHistory(messages) {
        const container = $('#chatMessages');
        const greeting = state.user && state.user.name
            ? `Здравствуйте, ${escapeHtml(state.user.name)}! Чем можем помочь?`
            : 'Здравствуйте! Чем можем помочь?';
        container.innerHTML = `<div class="message bot-message">${greeting}</div>`;
        if (!messages.length) {
            container.insertAdjacentHTML('beforeend', '<div class="chat-hint">Напишите вопрос — специалист поддержки ответит в этом чате.</div>');
        }
        messages.forEach((message) => addChatMessage(message.text, message.sender === 'user' ? 'user' : 'bot', message.time));
        container.scrollTop = container.scrollHeight;
    }

    async function openChat() {
        const windowNode = $('#chatWindow');
        windowNode.hidden = false;
        state.chatOpen = true;
        try {
            const messages = await api('/api/admin/chat');
            renderChatHistory(messages);
            await api(`${API}/chat/read`, { method: 'POST' });
            updateChatBadge(0);
            state.stats.unread_messages = 0;
        } catch (error) {
            $('#chatMessages').innerHTML = `<div class="chat-hint">${escapeHtml(error.message)}</div>`;
        }
    }

    function closeChat() {
        $('#chatWindow').hidden = true;
        state.chatOpen = false;
    }

    function initChat() {
        const chatBtn = $('#chatBtn');
        const chatForm = $('#chatForm');
        if (!chatBtn || !chatForm) return;

        chatBtn.addEventListener('click', () => {
            if (state.chatOpen) {
                closeChat();
            } else {
                openChat();
            }
        });
        $('#closeChat').addEventListener('click', closeChat);

        chatForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const input = $('#userInput');
            const text = input.value.trim();
            if (!text) return;
            addChatMessage(text, 'user', new Date().toISOString());
            input.value = '';
            try {
                await api('/api/admin/messages', { method: 'POST', body: { text } });
            } catch (error) {
                toast(error.message, 'error');
            }
        });

        api(`${API}/chat/unread`).then((data) => {
            updateChatBadge(data.unread);
            state.stats.unread_messages = data.unread;
        }).catch(() => {});

        if (typeof io === 'function') {
            const socket = io();
            socket.on('massage_touser', (data) => {
                const text = (data && data.text) || '';
                if (!text) return;
                if (state.chatOpen) {
                    addChatMessage(text, 'bot', data.time_send);
                    api(`${API}/chat/read`, { method: 'POST' }).catch(() => {});
                } else {
                    const unread = (Number(state.stats.unread_messages) || 0) + 1;
                    state.stats.unread_messages = unread;
                    updateChatBadge(unread);
                    toast('Новое сообщение от поддержки', 'info');
                }
            });
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Запуск                                                                 */
    /* ---------------------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', () => {
        initNavigation();
        initProfileForm();
        initAddressForm();
        initFavorites();
        initReviewForm();
        initSettings();
        initLogout();
        initChat();

        const refresh = $('#ordersRefresh');
        if (refresh) {
            refresh.addEventListener('click', () => loadOrders({ force: true }));
        }

        // Шапка, бейджи и данные профиля нужны на любой странице кабинета.
        loadProfile();
    });
})();
