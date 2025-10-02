document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    const header = document.querySelector('.agroapp-header');

    if (menuToggle && mainNav) {
        let isAnimating = false;

        // Modern toggle menu with haptic feedback simulation
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isAnimating) return;
            
            // Haptic feedback simulation
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            toggleMenu();
        });

        // Enhanced toggle function with smooth animations
        function toggleMenu() {
            isAnimating = true;
            
            const isActive = mainNav.classList.contains('active');
            
            if (isActive) {
                closeMenu();
            } else {
                openMenu();
            }
            
            // Reset animation lock
            setTimeout(() => {
                isAnimating = false;
            }, 400);
        }

        // Smooth open menu function
        function openMenu() {
            mainNav.classList.add('active');
            menuToggle.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scroll
            
            // Add focus trap for accessibility
            trapFocus(mainNav);
        }

        // Enhanced close menu function
        function closeMenu() {
            mainNav.classList.remove('active');
            menuToggle.classList.remove('active');
            document.body.style.overflow = ''; // Restore scroll
            
            // Return focus to toggle button
            menuToggle.focus();
        }

        // Close menu when clicking outside with smooth animation
        document.addEventListener('click', (e) => {
            if (!header.contains(e.target) && mainNav.classList.contains('active')) {
                closeMenu();
            }
        });

        // Close menu when clicking on nav links with delay for better UX
        const navLinks = mainNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Add ripple effect
                createRipple(e, link);
                
                // Delay close for visual feedback
                setTimeout(() => {
                    closeMenu();
                }, 150);
            });
        });

        // Handle dropdown toggles in mobile
        const dropdownToggles = mainNav.querySelectorAll('.nav-dropdown-toggle');
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const dropdown = toggle.closest('.nav-dropdown');
                const dropdownMenu = dropdown.querySelector('.nav-dropdown-menu');
                
                // Toggle active class for mobile dropdown
                if (window.innerWidth <= 768) {
                    dropdown.classList.toggle('active');
                }
            });
        });

        // Enhanced keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mainNav.classList.contains('active')) {
                closeMenu();
            }
            
            // Toggle with spacebar when focused
            if (e.key === ' ' && document.activeElement === menuToggle) {
                e.preventDefault();
                toggleMenu();
            }
        });

        // Focus trap for accessibility
        function trapFocus(element) {
            const focusableElements = element.querySelectorAll(
                'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
            );
            const firstFocusableElement = focusableElements[0];
            const lastFocusableElement = focusableElements[focusableElements.length - 1];

            element.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === firstFocusableElement) {
                            lastFocusableElement.focus();
                            e.preventDefault();
                        }
                    } else {
                        if (document.activeElement === lastFocusableElement) {
                            firstFocusableElement.focus();
                            e.preventDefault();
                        }
                    }
                }
            });
        }

        // Create ripple effect for nav links
        function createRipple(event, element) {
            const circle = document.createElement('span');
            const diameter = Math.max(element.clientWidth, element.clientHeight);
            const radius = diameter / 2;

            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${event.clientX - element.offsetLeft - radius}px`;
            circle.style.top = `${event.clientY - element.offsetTop - radius}px`;
            circle.classList.add('ripple');

            const ripple = element.getElementsByClassName('ripple')[0];
            if (ripple) {
                ripple.remove();
            }

            element.appendChild(circle);
            
            // Remove ripple after animation
            setTimeout(() => {
                circle.remove();
            }, 600);
        }

        // Add resize handler for responsive behavior
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && mainNav.classList.contains('active')) {
                closeMenu();
            }
        });

    } else {
        console.warn('⚠️ Menu elements not found. Please check your HTML structure.');
    }
});