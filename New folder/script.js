document.addEventListener("DOMContentLoaded", function () {
    // Select all product images
    const productImages = document.querySelectorAll(".product-image");

    // Loop through each product image and add a click event listener
    productImages.forEach(image => {
        image.addEventListener("click", function () {
            const category = image.getAttribute("data-category"); // Get the category of the clicked image
            const productList = document.getElementById(`${category}-list`); // Get the corresponding product list

            // Toggle the visibility of the product list
            if (productList.style.display === "none" || productList.style.display === "") {
                productList.style.display = "block";
            } else {
                productList.style.display = "none";
            }
        });
    });
});
