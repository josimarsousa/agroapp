document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-outline';
    toggle.style.marginLeft = '8px';
    toggle.textContent = 'Mostrar';
    toggle.addEventListener('click', () => {
      const isPwd = passwordInput.type === 'password';
      passwordInput.type = isPwd ? 'text' : 'password';
      toggle.textContent = isPwd ? 'Ocultar' : 'Mostrar';
    });
    const group = passwordInput.closest('.input-group');
    if (group) group.appendChild(toggle);
  }
});