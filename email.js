/**
 * Онлайн-запис: слоти з API + CRM, листи через EmailJS (email.js).
 *
 * Два листи після успішної відправки:
 * 1) Клініка — шаблон emailTemplateId, у полі To шаблону: {{to_email}} (береться з notificationEmail).
 * 2) Клієнт — emailClientTemplateId, To = {{to_email}}; у шаблоні — {{calendar_google_url}} (кнопка Google Calendar). Якщо ID шаблону порожній — лист клієнту не надсилається.
 *
 * Налаштування: window.DDC_BOOKING_CONFIG у contacts.html.
 */
(function () {
    const defaults = {
        serverUrl: "",
        emailJsPublicKey: "3aE3PRD6FPNUmLPSp",
        emailServiceId: "service_mu4rk4s",
        /** Лист на пошту клініки (дані клієнта). Має бути в тому ж EmailJS service, що й відправка. */
        emailTemplateId: "template_n4x054o",
        /** Auto-reply клієнту (To у шаблоні = {{to_email}}). */
        emailClientTemplateId: "template_hakuvvf",
        notificationEmail: "dzyubadc@gmail.com",
        /** Адреса для поля «місце» в події Google Calendar у листі клієнту */
        calendarLocation: "м. Гостомель, вул. Центральна, 1б",
    };

    const cfg = Object.assign({}, defaults, window.DDC_BOOKING_CONFIG || {});
    const baseUrl = (cfg.serverUrl || "").replace(/\/+$/, "");

    function toGoogleCalendarFormat(dateObj) {
        return dateObj.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    }

    /** Посилання «Додати в Google Календар» для листа клієнту (EmailJS {{calendar_google_url}}). */
    function buildGoogleCalendarTemplateUrl(title, details, location, startUtcCompact, endUtcCompact) {
        const loc = location || "м. Гостомель, вул. Центральна, 1б";
        const datesPart = startUtcCompact + "/" + endUtcCompact;
        return (
            "https://calendar.google.com/calendar/render?action=TEMPLATE" +
            "&text=" +
            encodeURIComponent(title) +
            "&dates=" +
            datesPart +
            "&details=" +
            encodeURIComponent(details || "") +
            "&location=" +
            encodeURIComponent(loc)
        );
    }

    function initEmailJs() {
        if (typeof emailjs === "undefined" || !cfg.emailJsPublicKey) return;
        emailjs.init({ publicKey: cfg.emailJsPublicKey });
    }

    /**
     * Спочатку лист клініці, потім (за наявності шаблону) підтвердження клієнту.
     * @returns {{ clientSent: boolean }}
     */
    async function sendClinicAndClientEmails(clinicParams, clientBase) {
        if (typeof emailjs === "undefined") {
            return { clientSent: false };
        }

        await emailjs.send(cfg.emailServiceId, cfg.emailTemplateId, clinicParams);

        let clientSent = false;
        const clientTpl = (cfg.emailClientTemplateId || "").trim();
        if (!clientTpl || !clientBase.to_email) {
            return { clientSent: false };
        }

        const eventTitle = "DDC — візит: " + clientBase.user_name + " " + clientBase.user_lastname;
        const calendarGoogleUrl = buildGoogleCalendarTemplateUrl(
            eventTitle,
            clientBase.confirmation_text || "Запис DZYUBA DENTAL CLINIC",
            cfg.calendarLocation,
            clientBase.start_datetime,
            clientBase.end_datetime,
        );

        const clientParams = {
            to_email: clientBase.to_email,
            user_name: clientBase.user_name,
            user_lastname: clientBase.user_lastname,
            user_phone: clientBase.user_phone,
            user_email: clientBase.user_email,
            appointment_date: clientBase.appointment_date,
            appointment_time: clientBase.appointment_time,
            start_datetime: clientBase.start_datetime,
            end_datetime: clientBase.end_datetime,
            confirmation_text: clientBase.confirmation_text,
            clinic_reply_email: cfg.notificationEmail,
            calendar_google_url: calendarGoogleUrl,
            time: new Date().toLocaleString("uk-UA"),
        };

        try {
            await emailjs.send(cfg.emailServiceId, clientTpl, clientParams);
            clientSent = true;
        } catch (err) {
            console.warn("Лист-підтвердження клієнту не відправлено:", err);
        }

        return { clientSent };
    }

    async function loadAvailableTimes(date) {
        const timeSelect = document.getElementById("appointment_time");
        const timeLoading = document.getElementById("time-loading");
        if (!timeSelect) return;

        if (!date) {
            timeSelect.disabled = true;
            timeSelect.innerHTML = '<option value="">Спочатку оберіть дату</option>';
            return;
        }

        if (!baseUrl) {
            timeSelect.disabled = true;
            timeSelect.innerHTML =
                '<option value="">Вкажіть serverUrl у window.DDC_BOOKING_CONFIG</option>';
            return;
        }

        if (timeLoading) timeLoading.hidden = false;
        timeSelect.disabled = true;
        timeSelect.innerHTML = '<option value="">Завантажуємо...</option>';

        try {
            const response = await fetch(`${baseUrl}/api/available-times/${encodeURIComponent(date)}`);
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();

            timeSelect.innerHTML = '<option value="">Оберіть час</option>';
            if (data.availableSlots && data.availableSlots.length > 0) {
                data.availableSlots.forEach(function (slot) {
                    const option = document.createElement("option");
                    option.value = slot;
                    option.textContent = slot;
                    timeSelect.appendChild(option);
                });
                timeSelect.disabled = false;
            } else {
                timeSelect.innerHTML = '<option value="">Немає доступних часів</option>';
            }
        } catch (err) {
            console.error("Error loading available times:", err);
            timeSelect.innerHTML = '<option value="">Помилка завантаження</option>';
            timeSelect.disabled = true;
        } finally {
            if (timeLoading) timeLoading.hidden = true;
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        if (!form || form.id !== "booking-form") return;

        const result = document.getElementById("form-result");
        const submitBtn = document.getElementById("booking-form-submit");
        if (!result || !submitBtn) return;

        const firstName = form.user_name.value.trim();
        const lastName = form.user_lastname.value.trim();
        const phone = form.user_phone.value.trim();
        const email = form.user_email.value.trim();
        const date = form.appointment_date.value;
        const time = form.appointment_time.value;

        if (!firstName || !lastName || !phone || !email || !date || !time) {
            result.innerHTML = '<span class="contacts-form-result__error">Усі поля повинні бути заповнені.</span>';
            result.classList.add("contacts-form-result--visible", "contacts-form-result--error");
            result.classList.remove("contacts-form-result--success");
            return;
        }

        if (!baseUrl) {
            result.innerHTML =
                '<span class="contacts-form-result__error">Не налаштовано serverUrl у window.DDC_BOOKING_CONFIG.</span>';
            result.classList.add("contacts-form-result--visible", "contacts-form-result--error");
            result.classList.remove("contacts-form-result--success");
            return;
        }

        result.innerHTML = "Надсилаємо…";
        result.classList.add("contacts-form-result--visible");
        result.classList.remove("contacts-form-result--error", "contacts-form-result--success");
        submitBtn.disabled = true;
        const prevLabel = submitBtn.textContent;
        submitBtn.textContent = "Надсилаємо…";

        const localDateTime = new Date(date + "T" + time);
        const endDateTime = new Date(localDateTime.getTime() + 30 * 60 * 1000);
        const start_datetime = toGoogleCalendarFormat(localDateTime);
        const end_datetime = toGoogleCalendarFormat(endDateTime);

        function showSuccess(html) {
            result.innerHTML = html;
            result.classList.add(
                "contacts-form-result--visible",
                "contacts-form-result--success",
                "contacts-form-result--fade",
            );
            result.classList.remove("contacts-form-result--error");
            form.reset();
            const timeSelect = document.getElementById("appointment_time");
            if (timeSelect) {
                timeSelect.disabled = true;
                timeSelect.innerHTML = '<option value="">Спочатку оберіть дату</option>';
            }
        }

        function showError(msg) {
            result.innerHTML = '<span class="contacts-form-result__error">' + msg + "</span>";
            result.classList.add("contacts-form-result--visible", "contacts-form-result--error");
            result.classList.remove("contacts-form-result--success", "contacts-form-result--fade");
        }

        function formatBookingSuccessMessage(clientSent, isCrmFallback) {
            const hasClientTpl = !!(cfg.emailClientTemplateId || "").trim();
            if (!hasClientTpl) {
                return (
                    '<span class="contacts-form-result__ok">Дякуємо за запис! Ми зв’яжемося з вами найближчим часом.</span>'
                );
            }
            if (clientSent) {
                const tail = isCrmFallback ? " Запит також зафіксовано електронною поштою." : "";
                return (
                    '<span class="contacts-form-result__ok">Дякуємо за запис! Підтвердження надіслано на вашу електронну пошту.' +
                    tail +
                    "</span>"
                );
            }
            return (
                '<span class="contacts-form-result__ok">Дякуємо за запис! Заявку прийнято; лист на вашу пошту не вдалося надіслати — перевірте спам або зателефонуйте нам.</span>'
            );
        }

        try {
            const bookingResponse = await fetch(`${baseUrl}/api/book-appointment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: firstName,
                    lastName: lastName,
                    phone: phone,
                    email: email,
                    appointmentDate: date,
                    appointmentTime: time,
                }),
            });

            if (!bookingResponse.ok) {
                let errText = "Не вдалося створити запис";
                try {
                    const errorData = await bookingResponse.json();
                    if (errorData && errorData.error) errText = errorData.error;
                } catch (_) {}
                throw new Error(errText);
            }

            const bookingData = await bookingResponse.json();
            const bd = bookingData && bookingData.data ? bookingData.data : {};

            const clinicParams = {
                to_email: cfg.notificationEmail,
                user_name: firstName,
                user_lastname: lastName,
                user_phone: phone,
                user_email: email,
                appointment_date: date,
                appointment_time: time,
                start_datetime: start_datetime,
                end_datetime: end_datetime,
                time: new Date().toLocaleString("uk-UA"),
                message:
                    "Новий запис на прийом (CRM ID: " +
                    (bd.patientId || "—") +
                    "):\nІм'я: " +
                    firstName +
                    "\nПрізвище: " +
                    lastName +
                    "\nТелефон: " +
                    phone +
                    "\nEmail: " +
                    email +
                    "\nДата: " +
                    date +
                    "\nЧас: " +
                    time +
                    "\nКабінет: " +
                    (bd.cabinetId || "—"),
            };

            const confirmationText =
                "Ваш запис підтверджено: " +
                date +
                " о " +
                time +
                ". Якщо потрібно змінити час, зателефонуйте клініці.";

            const clientBase = {
                to_email: email,
                user_name: firstName,
                user_lastname: lastName,
                user_phone: phone,
                user_email: email,
                appointment_date: date,
                appointment_time: time,
                start_datetime: start_datetime,
                end_datetime: end_datetime,
                confirmation_text: confirmationText,
            };

            const { clientSent } = await sendClinicAndClientEmails(clinicParams, clientBase);

            showSuccess(formatBookingSuccessMessage(clientSent, false));
        } catch (error) {
            console.error("Booking error:", error);
            try {
                const clinicParams = {
                    to_email: cfg.notificationEmail,
                    user_name: firstName,
                    user_lastname: lastName,
                    user_phone: phone,
                    user_email: email,
                    appointment_date: date,
                    appointment_time: time,
                    start_datetime: start_datetime,
                    end_datetime: end_datetime,
                    time: new Date().toLocaleString("uk-UA"),
                    message:
                        "Новий запис на прийом (CRM недоступний):\nІм'я: " +
                        firstName +
                        "\nПрізвище: " +
                        lastName +
                        "\nТелефон: " +
                        phone +
                        "\nEmail: " +
                        email +
                        "\nДата: " +
                        date +
                        "\nЧас: " +
                        time,
                };

                const confirmationText =
                    "Ми отримали ваш запит на запис: " +
                    date +
                    " о " +
                    time +
                    ". Менеджер зв’яжеться з вами для підтвердження.";

                const clientBase = {
                    to_email: email,
                    user_name: firstName,
                    user_lastname: lastName,
                    user_phone: phone,
                    user_email: email,
                    appointment_date: date,
                    appointment_time: time,
                    start_datetime: start_datetime,
                    end_datetime: end_datetime,
                    confirmation_text: confirmationText,
                };

                if (typeof emailjs !== "undefined") {
                    const { clientSent } = await sendClinicAndClientEmails(clinicParams, clientBase);
                    showSuccess(formatBookingSuccessMessage(clientSent, true));
                } else {
                    showError("Сталася помилка. Спробуйте ще раз або зателефонуйте нам.");
                }
            } catch (emailError) {
                console.error("Email error:", emailError);
                showError("Сталася помилка. Спробуйте ще раз або зателефонуйте нам.");
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = prevLabel;
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        initEmailJs();

        const form = document.getElementById("booking-form");
        if (!form) return;

        form.addEventListener("submit", handleSubmit);

        const dateInput = form.querySelector('input[name="appointment_date"]');
        if (dateInput) {
            const today = new Date().toISOString().split("T")[0];
            dateInput.min = today;
            dateInput.addEventListener("change", function () {
                loadAvailableTimes(this.value);
            });
        }

        document.querySelectorAll(".contacts-field--date-picker input[type='date']").forEach(function (input) {
            input.addEventListener("click", function () {
                if (typeof input.showPicker === "function") {
                    try {
                        input.showPicker();
                    } catch (_) {}
                }
            });
        });
    });
})();
