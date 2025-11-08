document.addEventListener('DOMContentLoaded', () => {
  const pwd = document.getElementById('password');
  if (pwd) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-outline';
    toggle.style.marginLeft = '8px';
    toggle.textContent = 'Mostrar';
    toggle.addEventListener('click', () => {
      const isPwd = pwd.type === 'password';
      pwd.type = isPwd ? 'text' : 'password';
      toggle.textContent = isPwd ? 'Ocultar' : 'Mostrar';
    });
    const group = pwd.closest('.form-group');
    if (group) group.appendChild(toggle);
  }
});