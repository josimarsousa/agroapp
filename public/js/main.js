document.addEventListener('DOMContentLoaded', () => {
    // Mobile optimization functions
    function initMobileOptimizations() {
        // Add touch-friendly classes
        document.body.classList.add('mobile-optimized');
        
        // Improve table responsiveness
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            if (!table.closest('.table-responsive')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-responsive';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });

        // Add smooth scrolling
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // Optimize viewport for mobile
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.head.appendChild(viewport);
        }
    }

    // Initialize mobile optimizations
    initMobileOptimizations();

    const productSearch = document.getElementById('productSearch');
    const searchResults = document.getElementById('searchResults');
    const selectedProductInfo = document.getElementById('selectedProductInfo');
    const productName = document.getElementById('productName');
    const productPrice = document.getElementById('productPrice');
    const productStock = document.getElementById('productStock');
    const quantityInput = document.getElementById('quantity');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const selectedProductId = document.getElementById('selectedProductId');
    const cartTableBody = document.getElementById('cartTableBody');
    const cartTotalElement = document.getElementById('cartTotal');
    const finalizeSaleBtn = document.getElementById('finalizeSaleBtn');
    const customerSelect = document.getElementById('customerSelect');

    let cart = []; // Array para armazenar os itens do carrinho

    // Função para atualizar o carrinho na interface
    function updateCartUI() {
        cartTableBody.innerHTML = ''; // Limpa a tabela
        let total = 0;

        if (cart.length === 0) {
            cartTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Carrinho vazio.</td></tr>';
            cartTotalElement.textContent = 'R$ 0,00';
            finalizeSaleBtn.disabled = true;
            return;
        }

        cart.forEach((item, index) => {
            const row = cartTableBody.insertRow();
            row.innerHTML = `
                <td data-label="Produto">${item.name}</td>
                <td data-label="Quantidade"><input type="number" class="cart-quantity" data-index="${index}" value="${item.quantity}" min="1" style="width: 60px;"></td>
                <td data-label="Preço unit">R$ ${item.unit_price.toFixed(2).replace('.', ',')}</td>
                <td data-label="Subtotal">R$ ${(item.quantity * item.unit_price).toFixed(2).replace('.', ',')}</td>
                <td><button class="btn btn-danger btn-sm remove-item" data-index="${index}">X</button></td>
            `;
            total += item.quantity * item.unit_price;
        });

        cartTotalElement.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        finalizeSaleBtn.disabled = false;
    }

    // Lidar com a busca de produtos (autocomplete)
    let searchTimeout;
    productSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = productSearch.value.trim();

        if (query.length < 2) {
            searchResults.style.display = 'none';
            selectedProductInfo.classList.remove('visible');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/products/api/search?query=${query}`);
                const data = await response.json();

                searchResults.innerHTML = '';
                if (data.success && data.products.length > 0) {
                    data.products.forEach(product => {
                        const div = document.createElement('div');
                        div.textContent = `${product.name} (R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')} - Estoque: ${product.stock_quantity})`;
                        div.dataset.productId = product.id;
                        div.dataset.productName = product.name;
                        div.dataset.productPrice = parseFloat(product.price);
                        div.dataset.productStock = product.stock_quantity;
                        div.addEventListener('click', () => {
                            // Preencher os dados do produto selecionado
                            selectedProductId.value = product.id;
                            productName.textContent = product.name;
                            productPrice.textContent = parseFloat(product.price).toFixed(2).replace('.', ',');
                            productStock.textContent = product.stock_quantity;
                            quantityInput.value = 1;
                            quantityInput.max = product.stock_quantity; // Definir limite de quantidade
                            selectedProductInfo.classList.add('visible');
                            searchResults.style.display = 'none';
                            productSearch.value = product.name; // Limpar ou preencher a busca
                            quantityInput.focus();
                        });
                        searchResults.appendChild(div);
                    });
                    searchResults.style.display = 'block';
                } else {
                    searchResults.style.display = 'none';
                }
            } catch (error) {
                console.error('Erro na busca de produtos:', error);
                searchResults.style.display = 'none';
            }
        }, 300); // Atraso para evitar muitas requisições
    });

    // Esconder resultados da busca ao clicar fora
    document.addEventListener('click', (event) => {
        if (!productSearch.contains(event.target) && !searchResults.contains(event.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Adicionar produto ao carrinho
    addToCartBtn.addEventListener('click', () => {
        const productId = selectedProductId.value;
        const name = productName.textContent;
        const price = parseFloat(productPrice.textContent.replace(',', '.'));
        const stock = parseInt(productStock.textContent);
        let quantity = parseInt(quantityInput.value);

        if (!productId || isNaN(quantity) || quantity <= 0) {
            alert('Por favor, selecione um produto e insira uma quantidade válida.');
            return;
        }

        if (quantity > stock) {
            alert(`Quantidade desejada (${quantity}) excede o estoque disponível (${stock}).`);
            quantityInput.value = stock; // Ajusta para o máximo disponível
            return;
        }

        const existingItemIndex = cart.findIndex(item => item.product_id == productId);

        if (existingItemIndex > -1) {
            // Se o item já existe, atualiza a quantidade
            const newQuantity = cart[existingItemIndex].quantity + quantity;
            if (newQuantity > stock) {
                alert(`Ao adicionar, a quantidade total (${newQuantity}) excede o estoque disponível (${stock}).`);
                return;
            }
            cart[existingItemIndex].quantity = newQuantity;
        } else {
            // Adiciona novo item
            cart.push({
                product_id: productId,
                name: name,
                unit_price: price,
                quantity: quantity,
                stock_available: stock // Manter o estoque para validação futura
            });
        }

        // Limpa a seleção e atualiza a interface
        productSearch.value = '';
        selectedProductInfo.classList.remove('visible');
        quantityInput.value = 1;
        updateCartUI();
    });

    // Lidar com a alteração de quantidade no carrinho
    cartTableBody.addEventListener('change', (event) => {
        if (event.target.classList.contains('cart-quantity')) {
            const index = event.target.dataset.index;
            let newQuantity = parseInt(event.target.value);

            if (isNaN(newQuantity) || newQuantity <= 0) {
                newQuantity = 1; // Volta para 1 se inválido
                event.target.value = 1;
            }

            const item = cart[index];
            if (newQuantity > item.stock_available) {
                alert(`Quantidade para ${item.name} excede o estoque disponível (${item.stock_available}).`);
                event.target.value = item.stock_available;
                item.quantity = item.stock_available;
            } else {
                item.quantity = newQuantity;
            }
            updateCartUI();
        }
    });

    // Remover item do carrinho
    cartTableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-item')) {
            const index = event.target.dataset.index;
            cart.splice(index, 1); // Remove o item do array
            updateCartUI();
        }
    });

    // Finalizar a venda
    finalizeSaleBtn.addEventListener('click', async () => {



        if (cart.length === 0) {
            alert('O carrinho está vazio. Adicione produtos antes de finalizar a venda.');
            return;
        }

        const customerId = customerSelect.value || null; // Pode ser null para venda avulsa

        const saleData = {
            customer_id: customerId,
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price // Envia o preço unitário para validação no backend
            }))
        };

        try {
            const response = await fetch('/sales/finalize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Inclui cookies de sessão
                body: JSON.stringify(saleData)
            });

            // Verifica se a resposta HTTP é OK (status 2xx)
            if (!response.ok) {
                // Tenta ler a mensagem de erro do servidor se for JSON
                const errorData = await response.json().catch(() => ({ 
                    message: `Erro do servidor (${response.status}): ${response.statusText}` 
                }));
                
                // Se for erro de autenticação, redireciona para login
                if (response.status === 401 && errorData.redirect) {
                    alert(errorData.message || 'Sessão expirada. Você será redirecionado para o login.');
                    window.location.href = errorData.redirect;
                    return;
                }
                
                throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
            }

            const result = await response.json(); // Tenta ler o JSON se a resposta for OK

            if (result.success) { // Seu backend deve enviar { success: true, message: ..., saleId: ... }
                alert(result.message);
                cart = [];
                updateCartUI();
                window.location.href = `/sales/${result.saleId}`;
            } else { // Se o backend enviar { success: false, message: ... }
                alert('Erro ao finalizar venda: ' + result.message);
            }
        } catch (error) {
            console.error('Erro na requisição de finalizar venda:', error);
            
            // Verifica se é erro de rede
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                alert('Erro de conexão com o servidor. Verifique sua internet e tente novamente.');
            } else {
                alert('Erro de comunicação com o servidor: ' + error.message);
            }
        }
    });

    // Inicializar o carrinho vazio na carga da página
    updateCartUI();
});