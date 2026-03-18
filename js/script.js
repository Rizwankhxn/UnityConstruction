$(document).ready(function() {
    // 0. Initialize AOS
    AOS.init({
        duration: 800,
        once: true,
        offset: 100
    });

    // 1. Splash Screen Logic
    setTimeout(function() {
        $('#splash-screen').css({
            'opacity': '0',
            'visibility': 'hidden'
        });
        $('body').css('overflow-y', 'auto');
    }, 2500);

    // 2. Navbar Scroll Effect
    $(window).scroll(function() {
        if ($(this).scrollTop() > 50) {
            $('.navbar').addClass('scrolled');
        } else {
            $('.navbar').removeClass('scrolled');
        }
    });

    // 3. Smooth Scrolling for Navigation Links
    $('.scroll-link').on('click', function(event) {
        if (this.hash !== "") {
            event.preventDefault();
            var hash = this.hash;
            var navHeight = $('.navbar').outerHeight();

            $('html, body').animate({
                scrollTop: $(hash).offset().top - navHeight + 10
            }, 300);
            
            if($('.navbar-collapse').hasClass('show')) {
                $('.navbar-toggler').click();
            }
        }
    });

    // 4. Active Link Highlighting on Scroll
    $(window).on('scroll', function() {
        var scrollPos = $(document).scrollTop();
        var navHeight = $('.navbar').outerHeight() + 20;
        
        $('.scroll-link').each(function() {
            var currLink = $(this);
            if(currLink.attr('href').charAt(0) === '#') {
                var refElement = $(currLink.attr('href'));
                if (refElement.length) {
                    if (refElement.position().top - navHeight <= scrollPos && refElement.position().top + refElement.height() > scrollPos) {
                        $('.scroll-link').removeClass("active");
                        currLink.addClass("active");
                    }
                }
            }
        });
    });

    // 5. Theme Toggle Logic
    $('#theme-toggle').on('click', function() {
        var $html = $('html');
        var currentTheme = $html.attr('data-bs-theme');
        var newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        $html.attr('data-bs-theme', newTheme);
        
        var $icon = $(this).find('i');
        if (newTheme === 'dark') {
            $icon.removeClass('fa-moon').addClass('fa-sun');
        } else {
            $icon.removeClass('fa-sun').addClass('fa-moon');
        }
    });

    // ---------------------------------------------------------
    // DYNAMIC BACKEND INTEGRATION STARTS HERE
    // ---------------------------------------------------------

    // Fetch Dynamic Projects
    function loadLiveProjects() {
        $.ajax({
            url: '/api/projects',
            method: 'GET',
            success: function(res) {
                if(res.message === 'success') {
                    const container = $('#dynamic-projects-container');
                    container.empty();
                    
                    if(res.data.length === 0) {
                        container.append('<div class="col-12 text-center text-muted">No portfolio projects published yet.</div>');
                        return;
                    }

                    res.data.forEach(function(p) {
                        // Only show completed ones logic can be added here, OR just show all
                        let imageSrc = p.imageUrl ? p.imageUrl : 'https://images.unsplash.com/photo-1541888086225-ee5ca396d18a?w=800&q=80'; // fallback
                        container.append(`
                            <div class="swiper-slide list-unstyled h-auto">
                                <div class="project-card overflow-hidden rounded position-relative shadow-sm" style="background-color: var(--bs-body-bg);">
                                    <img src="${imageSrc}" alt="${p.name}" class="img-fluid w-100" style="aspect-ratio: 4/3; object-fit: cover;">
                                    <div class="project-overlay d-flex align-items-center justify-content-center">
                                        <div class="text-center">
                                            <h5>${p.name}</h5>
                                            <p class="mb-0 fw-bold">${p.type} <span class="badge text-dark ms-2 bg-light">${p.status}</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `);
                    });
                    
                    // Initialize Project Swiper
                    new Swiper('.projectSwiper', {
                        slidesPerView: 1,
                        spaceBetween: 20,
                        pagination: { el: '.projectSwiper .swiper-pagination', clickable: true },
                        breakpoints: {
                            768: { slidesPerView: 2, spaceBetween: 30 },
                            1024: { slidesPerView: 3, spaceBetween: 30 }
                        }
                    });
                }
            }
        });
    }

    // Fetch Dynamic Testimonials
    function loadLiveTestimonials() {
        $.ajax({
            url: '/api/testimonials?public=true',
            method: 'GET',
            success: function(res) {
                if(res.message === 'success') {
                    const container = $('#dynamic-testimonials-container');
                    container.empty();
                    
                    if(res.data.length === 0) {
                        container.append('<div class="col-12 text-center text-muted">No reviews yet. Check back soon!</div>');
                        return;
                    }

                    res.data.forEach(function(t) {
                        let stars = '<i class="fas fa-star text-warning"></i>'.repeat(t.rating);
                        container.append(`
                            <div class="swiper-slide list-unstyled h-auto">
                                <div class="card border-0 shadow-sm h-100" style="background-color: var(--bs-body-bg);">
                                    <div class="card-body p-4 text-center">
                                        <div class="mb-3">${stars}</div>
                                        <p class="card-text fst-italic text-muted">"${t.review}"</p>
                                        <h6 class="fw-bold mt-4 mb-0">- ${t.clientName}</h6>
                                    </div>
                                </div>
                            </div>
                        `);
                    });

                    // Initialize Testimonial Swiper
                    new Swiper('.testimonialSwiper', {
                        slidesPerView: 1,
                        spaceBetween: 20,
                        pagination: { el: '.testimonialSwiper .swiper-pagination', clickable: true },
                        breakpoints: {
                            768: { slidesPerView: 2, spaceBetween: 30 },
                            1024: { slidesPerView: 3, spaceBetween: 30 }
                        }
                    });
                }
            }
        });
    }

    // Handle Contact Form via Nodemailer API
    $('#contactForm').submit(function(e) {
        e.preventDefault();
        
        const $btn = $(this).find('button[type="submit"]');
        const originalText = $btn.text();
        
        $btn.text('Sending...').prop('disabled', true);
        
        const data = {
            name: $('#contactName').val(),
            email: $('#contactEmail').val(),
            subject: $('#contactSubject').val(),
            message: $('#contactMessage').val()
        };

        $.ajax({
            url: '/api/contact',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(res) {
                $('#contactForm')[0].reset();
                $('#contactError').addClass('d-none');
                $('#contactSuccess').removeClass('d-none');
                
                // Show the Ethereal Email Preview URL
                if(res.previewUrl) {
                    $('#contactPreviewUrl').attr('href', res.previewUrl);
                }
                
                setTimeout(function() {
                    $btn.text(originalText).prop('disabled', false);
                    setTimeout(() => $('#contactSuccess').addClass('d-none'), 5000);
                }, 1000);
            },
            error: function() {
                $('#contactSuccess').addClass('d-none');
                $('#contactError').text('Failed to send message. Please try again!').removeClass('d-none');
                $btn.text(originalText).prop('disabled', false);
            }
        });
    });

    // Run fetching on initialization
    loadLiveProjects();
    loadLiveTestimonials();

});
