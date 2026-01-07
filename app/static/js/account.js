document.addEventListener('DOMContentLoaded', function() {
            // Переключение между разделами
            const menuLinks = document.querySelectorAll('.sidebar-menu a');
            const sections = document.querySelectorAll('.content-section');

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
        });