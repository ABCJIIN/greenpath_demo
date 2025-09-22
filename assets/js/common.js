$(function () {

    // AOS 스크롤 애니메이션
    AOS.init();

    // ========================
    // 캐시/상수
    // ========================
    const BP = 1280;
    const $win = $(window);
    const $doc = $(document);
    const $html = $('html');
    const $header = $('header');

    const $topBtn = $('.top-btn');

    const $navWrap = $('.nav-wrap');
    const $navBtnWrap = $('.nav-btn-wrap');
    const $navBtn = $('.nav-btn');
    const $menu = $('.nav-wrap nav');
    const $navLinks = $('.move-control a');

    const $moveArea = $('.move-area');
    const $sections = $('.move-sec');

    // 상태
    let isMobileMode = window.innerWidth <= BP;
    let lastY = $win.scrollTop();
    let areaTop = 0;
    let areaBottom = 0;
    let ticking = false;        // scroll rAF throttle
    let resizeTick = false;     // resize rAF debounce
    let isCompanyExpanded = false; // 풀스크린 확장 상태인지 여부
    let companyRO = null;

    // ========================
    // 유틸
    // ========================
    const isMobile = () => window.innerWidth <= BP;

    function recalcAreaBounds() {
        if (!$moveArea.length) {
            areaTop = Infinity;
            areaBottom = -Infinity;
            return;
        }
        const off = $moveArea.offset();
        areaTop = Math.floor(off.top);
        areaBottom = areaTop + $moveArea.outerHeight(true);
    }

    function inMoveArea(y) {
        return y >= areaTop && y < areaBottom;
    }

    // ========================
    // TOP 버튼
    // ========================
    $topBtn.hide();
    $win.on('scroll.topbtn', function () {
        if ($win.scrollTop() > 100) $topBtn.fadeIn(300);
        else $topBtn.fadeOut(300);
    });
    $topBtn.on('click', function () {
        $('html, body').stop().animate({ scrollTop: 0 }, 500);
    });

    // ========================
    // nav 버튼 라벨 동기화
    // ========================
    function syncNavBtnLabel() {
        const $active = $menu.find('a.on');
        const label = $active.length ? $.trim($active.text()) : $.trim($menu.find('a').first().text());
        $navBtn.find('span').text(label);
    }

    // ========================
    // 가시 섹션 계산 -> nav on 토글 + 버튼 라벨
    // ========================
    function getVisibleSection() {
        let maxVisibleRatio = 0;
        let mostVisibleId = null;

        const winH = window.innerHeight;
        const scrollY = window.scrollY || window.pageYOffset;
        const docH = $(document).height();
        const nearBottom = scrollY + winH >= docH - 2; // 바닥 보정

        if (nearBottom && $sections.length) {
            mostVisibleId = $sections.last().attr('id');
        } else {
            $sections.each(function () {
                const rect = this.getBoundingClientRect();
                const visibleHeight = Math.max(0, Math.min(winH, rect.bottom) - Math.max(0, rect.top));
                const ratio = visibleHeight / winH;
                if (ratio >= 0.2 && ratio > maxVisibleRatio) {
                    maxVisibleRatio = ratio;
                    mostVisibleId = this.id;
                }
            });
        }

        if (mostVisibleId) {
            $navLinks.each(function () {
                const targetId = $(this).attr('href').replace('#', '');
                $(this).toggleClass('on', targetId === mostVisibleId);
            });
            if (isMobile()) syncNavBtnLabel();
        }
    }

    // ========================
    // 메뉴 열기/닫기
    // ========================
    function openMenu() {
        syncNavBtnLabel();
        $html.addClass('is-scroll-lock');
        $navWrap.addClass('on');
        $navBtnWrap.addClass('on');
        if (isMobile()) $navWrap.addClass('reveal');
        $menu.stop(true, true).slideDown(200);
        $navBtn.addClass('on').attr('aria-expanded', 'true');
    }
    function closeMenu() {
        $html.removeClass('is-scroll-lock');
        $navWrap.removeClass('on');
        $navBtnWrap.removeClass('on');
        $menu.stop(true, true).slideUp(200);
        $navBtn.removeClass('on').attr('aria-expanded', 'false');
        if (isMobile()) {
            const y = $win.scrollTop();
            // 영역 안(= y >= areaTop)이면 reveal 유지, 아니면 제거
            if (y < areaTop) $navWrap.removeClass('reveal');
        }
    }

    // 드롭다운 토글 (모바일 전용)
    $navBtn.on('click', function (e) {
        if (!isMobile()) return;
        e.preventDefault();
        e.stopPropagation();          // 외부 클릭 핸들러로 전파 방지
        lastY = $win.scrollTop();     // ✅ 방향 판단 기준 고정
        $navBtn.hasClass('on') ? closeMenu() : openMenu();
    });

    // 메뉴 링크 클릭 -> 라벨 고정 + 닫기 (모바일 전용)
    $menu.on('click', 'a', function () {
        if (!isMobile()) return;
        $navBtn.find('span').text($.trim($(this).text()));
        closeMenu();
    });

    // 바깥 클릭 시 닫기 (모바일 전용)
    $doc.on('click', function (e) {
        if (!isMobile()) return;
        if (!$(e.target).closest($navWrap).length && $navBtn.hasClass('on')) closeMenu();
    });

    // ESC 닫기 (모바일 전용)
    $doc.on('keydown', function (e) {
        if (!isMobile()) return;
        if (e.key === 'Escape' && $navBtn.hasClass('on')) {
            closeMenu();
            $navBtn.focus();
        }
    });

    // ========================
    // .move-area 안/밖 + 스크롤 방향 -> header & nav-wrap 노출 제어
    // ========================
    function handleScroll() {
        const y = $win.scrollTop();
        const dir = y > lastY ? 'down' : (y < lastY ? 'up' : 'none');
        const inside = inMoveArea(y);

        // GSAP 확장 상태면 여기서 고정하고, 아래 헤더 토글 분기 스킵
        if (isCompanyExpanded) {
            if (!$header.hasClass('is-hide')) $header.addClass('is-hide');
            if (!$navWrap.hasClass('on-company')) $navWrap.addClass('on-company');

            lastY = y;
            return;
        }

        // 헤더 show/hide (기존 유지)
        if (inside) {
            if (dir === 'down') $header.addClass('is-hide');
            else if (dir === 'up') $header.removeClass('is-hide');
        } else {
            $header.removeClass('is-hide');
        }

        // .move-area 시작되면 nav-wrap에 .is-fixed 추가 / 해제
        if (y >= areaTop) {
            $navWrap.addClass('is-fixed');
        } else {
            $navWrap.removeClass('is-fixed');
        }

        // reveal: 메뉴 열림/애니메이션 중이면 항상 유지
        if (isMobile()) {
            const menuActive = $navBtn.hasClass('on') || $menu.is(':visible') || $menu.is(':animated');

            if (menuActive) {
                $navWrap.addClass('reveal');   // ← 여기서 강제 유지
            } else {
                if (y >= areaTop) $navWrap.addClass('reveal');
                else $navWrap.removeClass('reveal');
            }
        } else {
            $navWrap.removeClass('reveal');
        }

        // nav-btn-wrap 방향 토글 (보호 포함)
        if (isMobile()) {
            const menuActive = $navBtn.hasClass('on') || $menu.is(':visible') || $menu.is(':animated');
            if (menuActive) {
                $navBtnWrap.removeClass('is-hide');
            } else {
                if (y < lastY) $navBtnWrap.addClass('is-hide');
                else if (y > lastY) $navBtnWrap.removeClass('is-hide');
            }
        } else {
            $navBtnWrap.removeClass('is-hide');
        }

        lastY = y;
    }

    // scroll: rAF 스로틀
    $win.on('scroll.main', function () {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(function () {
                getVisibleSection();
                handleScroll();
                ticking = false;
            });
        }
    });

    // ========================
    // 앵커 스무스 스크롤 (CSS scroll-behavior와 중복 주의)
    // ========================
    $menu.on('click', 'a', function (e) {
        const href = $(this).attr('href');
        if (!href || href.charAt(0) !== '#') return;

        const $target = $(href);
        if (!$target.length) return;

        e.preventDefault();

        const headerH = $header.outerHeight() || 0;
        const targetTop = $target.offset().top - headerH;

        $('html, body').stop().animate({ scrollTop: targetTop }, 400, function () {
            // 완료 후 활성화/상태 보정
            getVisibleSection();
            handleScroll();
        });
    });

    // ========================
    // 리사이즈 (모드 전환 안전 처리)
    // ========================
    $win.on('resize.main', function () {
        if (!resizeTick) {
            resizeTick = true;
            requestAnimationFrame(function () {
                const prevMode = isMobileMode;
                isMobileMode = isMobile();

                recalcAreaBounds();
                // recalcCompanyBounds();

                if (prevMode !== isMobileMode) {
                    // 모드 바뀜 -> 상태 리셋
                    $html.removeClass('is-scroll-lock');
                    $navBtn.removeClass('on').attr('aria-expanded', 'false');
                    $navBtnWrap.removeClass('on is-hide');

                    if (isMobileMode) {
                        $menu.stop(true, true).hide();
                        $navWrap.removeClass('reveal on');
                        // 스크롤 위치로 다시 판단
                        handleScroll();
                    } else {
                        $menu.stop(true, true).show();
                        $navWrap.removeClass('reveal on'); // 데스크톱에서는 의미 없음
                        if (!isCompanyExpanded) $header.removeClass('is-hide');
                    }
                    syncNavBtnLabel();
                } else {
                    // 같은 모드면 경계/상태만 보정
                    handleScroll();
                    syncNavBtnLabel();
                }

                resizeTick = false;
            });
        }
    });

    // ========================
    // 초기 세팅
    // ========================
    recalcAreaBounds();
    syncNavBtnLabel();
    getVisibleSection();
    handleScroll();

    // 회사소개 슬라이드
    const companySlide = new Swiper(".company-slide", {
        slidesPerView: 1,
        spaceBetween: 30,
        observer: true,
        observeParents: true,
        pagination: {
            el: ".swiper-pagination",
        },
    });





    // 회사소개
    gsap.registerPlugin(ScrollTrigger);

    window.addEventListener("load", () => {
        let companyCtx = null;       // gsap.context 저장
        let companyTL  = null;       // 타임라인 저장

        function buildCompanyTimeline() {
            // 이전 타임라인/핸들러 깨끗하게 제거
            if (companyCtx) companyCtx.revert(true);

            const mm = gsap.matchMedia();

            companyCtx = gsap.context(() => {
                const section  = document.querySelector("#companyCont .company-sec");
                if (!section) return;
                const fullImg  = section.querySelector(".full_img");
                const bgStack  = section.querySelector(".bg-stack");
                const bTxt     = section.querySelector(".b_txt");
                const images   = gsap.utils.toArray(section.querySelectorAll(".bg-img"));
                const steps    = gsap.utils.toArray(section.querySelectorAll(".b_txt .step"));

                // 원래 인라인 스타일 저장(리버트 시 복구)
                // 기존: ScrollTrigger.saveStyles([bgStack, steps]);
                ScrollTrigger.saveStyles([fullImg, bgStack, bTxt, images, ...steps]);

                // 측정 함수
                function measure() {
                    const fullW = fullImg.clientWidth;
                    const fullH = fullImg.clientHeight;
                    const r     = bgStack.getBoundingClientRect();
                    const p     = fullImg.getBoundingClientRect();
                    const cs    = getComputedStyle(bgStack);
                    const right = parseFloat(cs.right) || 0;
                    const radius= parseFloat(cs.borderRadius) || 0;
                    return {
                        fullW, fullH,
                        init: {
                            width : r.width,
                            height: r.height,
                            right,
                            top   : ((p.height - r.height) / 2), // px 중앙
                            radius
                        }
                    };
                }

                // 초기 상태
                gsap.set(steps, { yPercent: -50, opacity: 0, force3D: true });
                if (steps[0]) gsap.set(steps[0], { opacity: 1 });

                let dims = measure();
                // const totalSegments = images.length + 2;
                const EXPAND_TRIGGER_FRAC = 0.25; // “조금 일찍” 붙이기

                // 전역 isCompanyExpanded(바깥에 있는 변수)와 타임라인 현재 위치를 동기화
                function syncExpandedFromTimeline() {
                    const t       = companyTL.time();
                    const tStart  = companyTL.labels.expandStart ?? 0;
                    const tDone   = companyTL.labels.expandDone  ?? (tStart + 1);
                    const tShrink = companyTL.labels.shrinkStart ?? companyTL.duration();
                    const tTrigger= tStart + (tDone - tStart) * EXPAND_TRIGGER_FRAC;
                    isCompanyExpanded = (t >= tTrigger && t < tShrink); // ← 전역 값 갱신
                }

                // 토글 헬퍼
                function applyExpandedClasses() {
                    if (isCompanyExpanded) {
                        $('header').addClass('is-hide');
                        $('.nav-wrap').addClass('on-company');
                    } else {
                        $('header').removeClass('is-hide');
                        $('.nav-wrap').removeClass('on-company');
                    }
                }

                companyTL = gsap.timeline({
                    defaults: { ease: "power2.out" },
                    scrollTrigger: {
                        trigger: fullImg,
                        start: "top top",
                        end: () => "+=" + (window.innerHeight * (images.length + 1.6)),
                        scrub: true,
                        pin: true,
                        anticipatePin: 1,
                        refreshPriority: 2,
                        invalidateOnRefresh: true,
                        onRefreshInit: () => { dims = measure(); },

                        // 스크롤 진행 시: 먼저 전역 동기화 → 상태 바뀌었으면 클래스 적용
                        onUpdate: () => {
                            const prev = isCompanyExpanded;
                            syncExpandedFromTimeline();
                            if (isCompanyExpanded !== prev) applyExpandedClasses();
                        },

                        // 리프레시(리사이즈 등) 직후에도 현재 위치 기준으로 전역 동기화 + 적용
                        onRefresh: () => {
                            syncExpandedFromTimeline();
                            applyExpandedClasses();
                            gsap.set(bgStack, { top: "50%", yPercent: -50 }); // 리프레시 안정화
                        }
                    }
                });

                // 라벨 & 트윈
                companyTL.addLabel('expandStart')
                    .to(bgStack, {
                        width: () => dims.fullW,
                        height: () => dims.fullH,
                        right: 0,
                        top: "50%",
                        yPercent: -50,
                        borderRadius: 0,
                        duration: 1
                    }, 'expandStart')
                    .addLabel('expandDone');

                    images.forEach((img, i) => {
                        const nextImg  = images[i + 1];
                        const curStep  = steps[i];
                        const nextStep = steps[i + 1];

                        if (nextImg) {
                            companyTL.to(img,     { opacity: 0, duration: 0.7 }, "+=0.05")
                                    .to(nextImg, { opacity: 1, duration: 0.7 }, "<");
                        }
                        if (curStep && nextStep) {
                            companyTL.to(curStep,  { yPercent: -300, opacity: 0, duration: 0.55 }, "<")
                                    .fromTo(nextStep, { yPercent: 50, opacity: 0 },
                                                    { yPercent: -50, opacity: 1, duration: 0.55, immediateRender:false }, "<");
                        }
                    });

                companyTL.addLabel('shrinkStart')
                .to(bgStack, {
                    width:  () => dims.init.width,
                    height: () => dims.init.height,
                    right:  () => dims.init.right,
                    top:    "50%",
                    yPercent: -50,
                    borderRadius: () => dims.init.radius,
                    duration: 1,
                    clearProps: "x,y"
                }, "+=0.05")
                    // 최종 스냅: 픽셀/퍼센트 기준 섞여 튀는 것 방지
                .call(() => {
                    gsap.set(bgStack, { top: "50%", yPercent: -50 });
                });

                // 빌드 직후에도 현재 위치 기준으로 1회 반영(초기 깜빡임 방지)
                syncExpandedFromTimeline();
                applyExpandedClasses();
                
            }, "#companyCont"); // context 스코프
        }

        // 리사이즈 즉시 반영 (더블 rAF)
        function scheduleRebuild() {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    buildCompanyTimeline();
                    recalcAreaBounds();
                    ScrollTrigger.refresh();
                });
            });
        }

        // 최초
        buildCompanyTimeline();
        ScrollTrigger.refresh();

        // 창 크기/방향 전환
        window.addEventListener("resize", scheduleRebuild);
        window.addEventListener("orientationchange", scheduleRebuild);

        // 폰트 로드 완료 후도 한 번 더
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleRebuild);
        }

        // 리사이즈/방향전환 시 rAF 디바운스 후 재빌드
        let rebuildId = null;
        window.addEventListener("resize", () => {
            cancelAnimationFrame(rebuildId);
            rebuildId = requestAnimationFrame(() => {
                buildCompanyTimeline();
                ScrollTrigger.refresh();
            });
        });
        window.addEventListener("orientationchange", () => {
            buildCompanyTimeline();
            ScrollTrigger.refresh();
        });


    });





});







$(function () {
    const $main   = $('.main');
    const $first  = $main.find('section').eq(0);
    const $second = $main.find('section').eq(1);
    if (!$first.length || !$second.length) return;

    const $header = $('header');
    const $html   = $('html');
    const $word   = $second.find('.word');

    let isSnapping = false;   // 애니 중 중복 방지
    let played = false;       // .word 애니는 1회만

    // .word 분해 (br 보존)
    function prepareWord($els) {
        $els.each(function () {
            const node = this;
            if (!node || !node.childNodes) return; // null 방지
            const frag = document.createDocumentFragment();
            Array.from(node.childNodes).forEach(n => {
                if (n.nodeType === 3) {
                    for (const ch of Array.from(n.textContent)) {
                        const s = document.createElement('span');
                        s.className = 'letter';
                        s.textContent = ch === ' ' ? '\u00A0' : ch;
                        frag.appendChild(s);
                    }
                } else if (n.nodeType === 1 && n.tagName === 'BR') {
                    frag.appendChild(n.cloneNode(false));
                }
            });
            node.innerHTML = '';
            node.appendChild(frag);
        });
    }

    // 첫 섹션이 화면에 충분히 보이는지(스냅 오작동 방지)
    function firstDominant(threshold = 0.05) {
        const winH = window.innerHeight;
        const r = $first[0].getBoundingClientRect();
        const visible = Math.max(0, Math.min(winH, r.bottom) - Math.max(0, r.top));
        return (visible / winH) >= threshold;
    }

    function playWord() {
        if (played) return;
        played = true;
        $word.find('.letter').each(function (i) {
            setTimeout(() => $(this).addClass('on'), 500 + i * 50);
        });
    }

    // 준비
    if ($word.length) {
        prepareWord($word);
    }

    // 1섹션 → 2섹션 스냅 (항상 재실행)
    $first.on('wheel.snapToSecond', function (e) {
        if (isSnapping) return;

        const dy = e.originalEvent.deltaY || 0;
        if (dy <= 0) return;                // 위로는 무시
        if (!firstDominant()) return;       // 첫 섹션이 충분히 보일 때만

        if (e.cancelable) e.preventDefault();
        isSnapping = true;

        const prevBehavior = $html.css('scroll-behavior');
        $html.css('scroll-behavior', 'auto');

        const headerH  = $header.outerHeight() || 0;
        const targetTop = Math.max(0, $second.offset().top - headerH);

        $('html, body').stop(true).animate(
        { scrollTop: targetTop }, 600, 'swing', function () {
            $html.css('scroll-behavior', prevBehavior);
            isSnapping = false;   // ← 애니 끝나면 다시 스냅 가능
            playWord();           // 도착 후 .word 1회 애니
        }
        );
    });

    // 자연 스크롤로 내려간 경우도 .word 1회 재생
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(en => { if (en.isIntersecting) { playWord(); obs.disconnect(); } });
        }, { threshold: 0.4 });
        io.observe($second[0]);
    } else {
        $(window).on('scroll.wordOnce', function () {
        const headerH = $header.outerHeight() || 0;
        const triggerY = $second.offset().top - headerH - window.innerHeight * 0.4;
        if (!played && $(this).scrollTop() >= triggerY) {
            playWord();
            $(window).off('scroll.wordOnce');
        }
        });
    }
});