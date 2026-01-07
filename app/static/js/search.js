
function goToPage(page) {
        currentPage = page;
        q=document.getElementById("searchInput").value.trim();
        category=document.getElementById("categorySelect").value;
        price=document.getElementById("priceSelect").value;
        price_order=document.getElementById("sortSelect").value;
        // page=document.getElementById("paginationNumbers").textContent.trim();
        window.location.href=`/search?q=${q}&page=${page}&category=${category}&price=${price}&price_order=${price_order}`

    }
document.getElementById("categorySelect").addEventListener('change', () => {
    goToPage(1);

})
document.getElementById("priceSelect").addEventListener('change', () => {
    goToPage(1);


})
document.getElementById("sortSelect").addEventListener('change', () => {
    goToPage(1);


})