window.onload = function() {
    document.getElementById("show-all").onclick=function(){
        document.getElementById("main-content").classList.toggle("show-all");
    };
    var path = window.location.pathname;
    path = path === '/' ? path : path.substring(0, path.length - 1);
    var menuItem = document.querySelector('.menu-item a[href^="' + path + '"]');
    if(menuItem && menuItem.parentElement){
        menuItem.parentElement.classList.add('menu-item-active');
    }
};