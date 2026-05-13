(function () {
    const intro = document.getElementById("brand-intro");
    if (!intro) {
        document.body.classList.remove("brand-intro-lock");
        return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minShow = reduced ? 900 : 2800;

    let done = false;
    function exit() {
        if (done) return;
        done = true;
        intro.classList.add("brand-intro--exit");
        const cleanup = () => {
            intro.remove();
            document.body.classList.remove("brand-intro-lock");
        };
        intro.addEventListener(
            "transitionend",
            (e) => {
                if (e.target === intro && e.propertyName === "opacity") cleanup();
            },
            { once: true },
        );
        setTimeout(cleanup, 1200);
    }

    function reveal() {
        intro.classList.add("brand-intro--ready");
        setTimeout(exit, minShow);
    }

    if (reduced) reveal();
    else requestAnimationFrame(() => requestAnimationFrame(reveal));

    setTimeout(exit, 7000);
})();

(function () {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = document.querySelectorAll(
        "main section, main .btn-block, footer",
    );
    if (!nodes.length) return;

    nodes.forEach((el) => {
        if (
            el.classList.contains("scroll-reveal-off") ||
            el.closest(".brand-intro")
        )
            return;
        el.classList.add("scroll-reveal");
    });

    const monitored = document.querySelectorAll(".scroll-reveal");
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach(({ isIntersecting, target }) => {
                if (!isIntersecting) return;
                target.classList.add("scroll-reveal--inview");
                io.unobserve(target);
            });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    monitored.forEach((el) => io.observe(el));
})();

(function () {
    let page = window.location.pathname.split(/[/\\]/).pop();
    if (!page || page === "") page = "index.html";
    document.querySelectorAll(".links-header a").forEach((link) => {
        const href = (link.getAttribute("href") || "").replace(/^\.\//, "");
        if (href === page) link.classList.add("nav-current");
    });
})();

(function () {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".header-nav-toggle");
    const bar = document.getElementById("site-header-bar");
    if (!header || !toggle || !bar) return;

    const mq = window.matchMedia("(max-width: 992px)");

    function setOpen(open) {
        header.classList.toggle("is-nav-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        document.body.classList.toggle("nav-drawer-open", open);
    }

    function closeIfWide() {
        if (!mq.matches) setOpen(false);
    }

    toggle.addEventListener("click", function () {
        setOpen(!header.classList.contains("is-nav-open"));
    });

    bar.querySelectorAll("a[href]").forEach(function (link) {
        link.addEventListener("click", function () {
            setOpen(false);
        });
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setOpen(false);
    });

    if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", closeIfWide);
    } else if (typeof mq.addListener === "function") {
        mq.addListener(closeIfWide);
    }
    window.addEventListener("resize", closeIfWide);
})();

(function () {
    const faqRoot = document.querySelector(".faq-section-questions");
    if (!faqRoot) return;

    faqRoot.querySelectorAll(".faq-item").forEach((item) => {
        const btn = item.querySelector(".faq-trigger");
        const panel = item.querySelector(".faq-panel");
        if (!btn || !panel) return;

        const setOpen = (open) => {
            item.classList.toggle("is-open", open);
            btn.setAttribute("aria-expanded", open ? "true" : "false");
            panel.setAttribute("aria-hidden", open ? "false" : "true");
        };

        btn.addEventListener("click", () => {
            const wasOpen = item.classList.contains("is-open");
            faqRoot.querySelectorAll(".faq-item").forEach((el) => {
                const b = el.querySelector(".faq-trigger");
                const p = el.querySelector(".faq-panel");
                if (!b || !p) return;
                el.classList.remove("is-open");
                b.setAttribute("aria-expanded", "false");
                p.setAttribute("aria-hidden", "true");
            });
            if (!wasOpen) setOpen(true);
        });

        setOpen(item.classList.contains("is-open"));
    });
})();

(function () {
    const marquees = document.querySelectorAll(".reviews-marquee");
    if (!marquees.length) return;

    const firstMarqueeTrack = marquees[0].querySelector(".reviews-marquee-track");
    const sourceHtml = firstMarqueeTrack ? firstMarqueeTrack.innerHTML : "";

    const instances = [];

    marquees.forEach((marquee) => {
        const tracks = marquee.querySelectorAll(".reviews-marquee-track");
        if (tracks.length < 2) return;

        // Ensure both tracks in each row are visually identical.
        if (!tracks[0].children.length && sourceHtml) {
            tracks[0].innerHTML = sourceHtml;
        }
        tracks[1].innerHTML = tracks[0].innerHTML;

        instances.push({
            tracks,
            offset: 0,
            width: 0,
            reverse: marquee.classList.contains("reviews-marquee-reverse"),
        });
    });

    if (!instances.length) return;

    const speed = 85;
    let lastTimestamp = 0;

    function measure(instance) {
        instance.width = instance.tracks[0].getBoundingClientRect().width;
    }

    function render(instance) {
        if (!instance.width) return;

        if (instance.reverse) {
            instance.tracks[0].style.transform = `translate3d(${instance.offset}px, 0, 0)`;
            instance.tracks[1].style.transform = `translate3d(${instance.offset - instance.width}px, 0, 0)`;
            return;
        }

        instance.tracks[0].style.transform = `translate3d(${-instance.offset}px, 0, 0)`;
        instance.tracks[1].style.transform = `translate3d(${instance.width - instance.offset}px, 0, 0)`;
    }

    function animate(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        instances.forEach((instance) => {
            if (!instance.width) return;
            instance.offset += speed * delta;
            instance.offset %= instance.width;
            render(instance);
        });

        requestAnimationFrame(animate);
    }

    function reset() {
        instances.forEach((instance) => {
            instance.offset = 0;
            measure(instance);
            render(instance);
        });
    }

    window.addEventListener("resize", reset);
    window.addEventListener("load", reset);

    if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => reset());
        instances.forEach((instance) => observer.observe(instance.tracks[0]));
    }

    reset();
    requestAnimationFrame(animate);
})();
