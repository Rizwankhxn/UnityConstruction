$(document).ready(function () {
    // API Endpoints
    const apiBase = '/api';

    // Fetch and load Dashboard Data
    function loadDashboard() {
        fetchStats();
        fetchProjects();
        fetchTestimonials();
    }

    // Load Stats
    function fetchStats() {
        $.ajax({
            url: `${apiBase}/dashboard/stats`,
            method: 'GET',
            success: function (res) {
                if (res.message === 'success') {
                    $('#stat-total').text(res.data.totalProjects);
                    $('#stat-ongoing').text(res.data.ongoingProjects);
                    $('#stat-completed').text(res.data.completedProjects);
                }
            }
        });
    }

    function getStatusBadge(status) {
        switch (status) {
            case 'Ongoing': return 'bg-info';
            case 'Completed': return 'bg-success';
            case 'Planning': return 'bg-primary';
            case 'On Hold': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    // ---------------- PROJECTS ----------------

    function fetchProjects() {
        $.ajax({
            url: `${apiBase}/projects`,
            method: 'GET',
            success: function (res) {
                if (res.message === 'success') {
                    if ($.fn.DataTable.isDataTable('#projectsTable')) {
                        $('#projectsTable').DataTable().destroy();
                    }
                    const tbody = $('#projectsTable tbody');
                    tbody.empty();

                    if (res.data.length > 0) {
                        res.data.forEach(function (project) {
                            let imgThumb = project.imageUrl ? `<img src="${project.imageUrl}" class="rounded" style="width: 40px; height: 40px; object-fit: cover; margin-right: 10px;">` : `<div class="bg-secondary rounded d-inline-block" style="width: 40px; height: 40px; margin-right: 10px;"></div>`;
                            tbody.append(`
                                <tr>
                                    
                                    <td class="fw-bold d-flex align-items-center">${imgThumb} ${project.name}</td>
                                    <td>${project.client}</td>
                                    <td><span class="badge bg-secondary">${project.type}</span></td>
                                    <td><span class="badge ${getStatusBadge(project.status)}">${project.status}</span></td>
                                    <td>${project.startDate}</td>
                                    <td class="text-center">
                                        <button class="btn btn-sm btn-outline-primary me-2 btn-edit" data-id="${project.id}"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${project.id}" data-type="project"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `);
                        });
                    }

                    $('#projectsTable').DataTable({
                        pageLength: 5,
                        lengthMenu: [5, 10, 25, 50],
                        language: {
                            emptyTable: "No projects found. Create one!"
                        }
                    });
                }
            }
        });
    }

    $('#btnAddProject').click(function () {
        $('#projectModalLabel').text('Add New Project');
        $('#projectForm')[0].reset();
        $('#projectId').val('');
        $('#existingImage').val('');
        $('#modalSuccess').addClass('d-none');
    });

    $('#projectForm').submit(function (e) {
        e.preventDefault();

        const id = $('#projectId').val();
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${apiBase}/projects/${id}` : `${apiBase}/projects`;

        let formData = new FormData();
        formData.append('name', $('#projectName').val());
        formData.append('client', $('#projectClient').val());
        formData.append('type', $('#projectType').val());
        formData.append('status', $('#projectStatus').val());
        formData.append('budget', $('#projectBudget').val());
        formData.append('startDate', $('#projectStart').val());
        formData.append('existingImage', $('#existingImage').val());

        const fileInput = $('#projectImage')[0].files[0];
        if (fileInput) {
            formData.append('image', fileInput);
        }

        $.ajax({
            url: url,
            method: method,
            data: formData,
            processData: false,
            contentType: false,
            success: function () {
                $('#modalSuccess').removeClass('d-none');
                setTimeout(function () {
                    $('#projectModal').modal('hide');
                    $('#modalSuccess').addClass('d-none');
                    loadDashboard();
                }, 1500);
            },
            error: function (err) {
                alert('Error saving project.');
                console.error(err);
            }
        });
    });

    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: `${apiBase}/projects/${id}`,
            method: 'GET',
            success: function (res) {
                if (res.message === 'success') {
                    const data = res.data;
                    $('#projectId').val(data.id);
                    $('#projectName').val(data.name);
                    $('#projectClient').val(data.client);
                    $('#projectType').val(data.type);
                    $('#projectStatus').val(data.status);
                    $('#projectBudget').val(data.budget);
                    $('#projectStart').val(data.startDate);
                    $('#existingImage').val(data.imageUrl || '');

                    $('#modalSuccess').addClass('d-none');
                    $('#projectModalLabel').text('Edit Project');
                    $('#projectModal').modal('show');
                }
            }
        });
    });

    // ---------------- TESTIMONIALS ----------------

    function fetchTestimonials() {
        $.ajax({
            url: `${apiBase}/testimonials`,
            method: 'GET',
            success: function (res) {
                if (res.message === 'success') {
                    if ($.fn.DataTable.isDataTable('#testimonialsTable')) {
                        $('#testimonialsTable').DataTable().destroy();
                    }
                    const tbody = $('#testimonialsTable tbody');
                    tbody.empty();
                    
                    if (res.data.length > 0) {
                        res.data.forEach(function (t) {
                            let stars = '<i class="fas fa-star text-warning"></i>'.repeat(t.rating);
                            let viz = t.isVisible ? '<span class="badge bg-success">Visible</span>' : '<span class="badge bg-secondary">Hidden</span>';
                            tbody.append(`
                                <tr>
                                    
                                    <td class="fw-bold">${t.clientName}</td>
                                    <td><small class="text-muted">${t.review.substring(0, 50)}...</small></td>
                                    <td>${stars}</td>
                                    <td>${viz}</td>
                                    <td class="text-center">
                                        <button class="btn btn-sm btn-outline-primary me-2 btn-edit-test" data-id="${t.id}"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${t.id}" data-type="testimonial"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `);
                        });
                    }

                    $('#testimonialsTable').DataTable({
                        pageLength: 5,
                        lengthMenu: [5, 10, 25, 50],
                        language: {
                            emptyTable: "No testimonials found."
                        }
                    });
                }
            }
        });
    }

    $('#btnAddTestimonial').click(function () {
        $('#testimonialModalLabel').text('Add Testimonial');
        $('#testimonialForm')[0].reset();
        $('#testimonialId').val('');
        $('#modalTestimonialSuccess').addClass('d-none');
    });

    $('#testimonialForm').submit(function (e) {
        e.preventDefault();
        const id = $('#testimonialId').val();
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${apiBase}/testimonials/${id}` : `${apiBase}/testimonials`;

        const tData = {
            clientName: $('#testimonialName').val(),
            review: $('#testimonialReview').val(),
            rating: $('#testimonialRating').val(),
            isVisible: $('#testimonialVisible').val()
        };

        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(tData),
            success: function () {
                $('#modalTestimonialSuccess').removeClass('d-none');
                setTimeout(function () {
                    $('#testimonialModal').modal('hide');
                    $('#modalTestimonialSuccess').addClass('d-none');
                    loadDashboard();
                }, 1500);
            },
            error: function (err) {
                alert('Error saving.');
            }
        });
    });

    $(document).on('click', '.btn-edit-test', function () {
        const id = $(this).data('id');
        $.ajax({
            url: `${apiBase}/testimonials/${id}`,
            method: 'GET',
            success: function (res) {
                if (res.message === 'success') {
                    const data = res.data;
                    $('#testimonialId').val(data.id);
                    $('#testimonialName').val(data.clientName);
                    $('#testimonialReview').val(data.review);
                    $('#testimonialRating').val(data.rating);
                    $('#testimonialVisible').val(data.isVisible);

                    $('#modalTestimonialSuccess').addClass('d-none');
                    $('#testimonialModalLabel').text('Edit Testimonial');
                    $('#testimonialModal').modal('show');
                }
            }
        });
    });

    // ---------------- GLOBAL DELETE HUB ----------------

    let currentDeleteId = null;
    let currentDeleteType = null;

    $(document).on('click', '.btn-delete', function () {
        currentDeleteId = $(this).data('id');
        currentDeleteType = $(this).data('type'); // 'project' or 'testimonial'
        $('#deleteModal').modal('show');
    });

    $('#confirmDeleteBtn').click(function () {
        if (currentDeleteId && currentDeleteType) {
            const url = currentDeleteType === 'project' ? `${apiBase}/projects/${currentDeleteId}` : `${apiBase}/testimonials/${currentDeleteId}`;
            $.ajax({
                url: url,
                method: 'DELETE',
                success: function () {
                    $('#deleteModal').modal('hide');
                    loadDashboard();
                },
                error: function () {
                    alert('Error deleting item.');
                }
            });
        }
    });

    // Theme Toggle Logic
    $('#themeTgl').on('click', function () {
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

    // Initial Load
    loadDashboard();
});
