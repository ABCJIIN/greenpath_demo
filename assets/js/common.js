$(function () {

    // AOS 스크롤 애니메이션
    AOS.init();

    // ========================
    // 캐시/상수
    // ========================
    const BP = 1280;
    const $win = $(window);
    const $html = $('html');
    const $header = $('header');
    const $main   = $('.main');

    const $topBtn = $('.top-btn');

    const $first  = $main.find('section').eq(0);
    const $second = $main.find('section').eq(1);
    const $word   = $second.find('.word');

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
    let isCompanyExpanded = false; // 풀스크린 확장 상태인지 여부
    let isSnapping = false;   // 애니 중 중복 방지
    let played = false;       // .word 애니는 1회만
    let companyCtx = null;       // gsap.context 저장
    let companyTL  = null;       // 타임라인 저장

    // 회사 섹션 스크럽 길이 안정화를 위한 초기 VH 캐시
    let initVH = null;

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
    // 1,2번째 섹션 이동 및 모션
    // ========================
    if (!$first.length || !$second.length) return;
    
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
    // nav 버튼
    // ========================

    // 라벨 동기화
    function syncNavBtnLabel() {
        const $active = $menu.find('a.on');
        const label = $active.length ? $.trim($active.text()) : $.trim($menu.find('a').first().text());
        $navBtn.find('span').text(label);
    }

    // 가시 섹션 계산 -> nav on 토글 + 버튼 라벨
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

    // 메뉴 열기/닫기
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

    // 드롭다운 토글
    $navBtn.on('click', function (e) {
        if (!isMobile()) return;
        e.preventDefault();
        e.stopPropagation();
        lastY = $win.scrollTop();
        $navBtn.hasClass('on') ? closeMenu() : openMenu();
    });

    // 메뉴 링크 클릭 -> 라벨 고정 + 닫기
    $menu.on('click', 'a', function () {
        if (!isMobile()) return;
        $navBtn.find('span').text($.trim($(this).text()));
        closeMenu();
    });

    // ========================
    // .move-area 안/밖 + 스크롤 방향 -> header & nav-wrap 노출 제어
    // ========================
    function handleScroll() {
        const y = $win.scrollTop();
        const dir = y > lastY ? 'down' : (y < lastY ? 'up' : 'none');
        const inside = inMoveArea(y);
        const mobile = isMobile();
        const menuActive = mobile && ($navBtn.hasClass('on') || $menu.is(':visible') || $menu.is(':animated'));

        // GSAP 확장 상태면 고정 처리 후 종료
        if (isCompanyExpanded) {
            if (!$header.hasClass('is-hide')) $header.addClass('is-hide');
            if (!$navWrap.hasClass('on-company')) $navWrap.addClass('on-company');
            lastY = y;
            return;
        }

        // 헤더 show/hide
        if (inside) {
            if (dir === 'down') $header.addClass('is-hide');
            else if (dir === 'up') $header.removeClass('is-hide');
        } else {
            $header.removeClass('is-hide');
        }

        // nav-wrap 고정 여부
        $navWrap.toggleClass('is-fixed', y >= areaTop);

        // reveal 제어 (모바일만 의미 있음)
        if (mobile) {
            if (menuActive) {
            $navWrap.addClass('reveal');
            } else {
            $navWrap.toggleClass('reveal', y >= areaTop);
            }
        } else {
            $navWrap.removeClass('reveal');
        }

        // nav-btn-wrap 방향 토글 (모바일)
        if (mobile) {
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
    // 초기 세팅
    // ========================
    recalcAreaBounds();
    syncNavBtnLabel();
    getVisibleSection();
    handleScroll();

    // ========================
    // 회사소개 (GSAP)
    // ========================
    gsap.registerPlugin(ScrollTrigger);
    // 모바일 주소창 show/hide 등 가짜 리사이즈로 인한 내부 refresh 방지
    ScrollTrigger.config({
        ignoreMobileResize: true,
        autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" // resize 제외
    });

    function buildCompanyTimeline() {
        // 이전 타임라인/핸들러 깨끗하게 제거
        if (companyCtx) companyCtx.revert(true);

        companyCtx = gsap.context(() => {
            const section  = document.querySelector("#companyCont .company-sec");
            if (!section) return;
            const fullImg  = section.querySelector(".full_img");
            const bgStack  = section.querySelector(".bg-stack");
            const bTxt     = section.querySelector(".b_txt");
            const images   = gsap.utils.toArray(section.querySelectorAll(".bg-img"));
            const steps    = gsap.utils.toArray(section.querySelectorAll(".b_txt .step"));

            // 초기 VH 캐시 (한 번만)
            if (initVH == null) {
                initVH = (window.visualViewport?.height ?? window.innerHeight);
            }

            gsap.set(fullImg, { height: initVH }); // ← 추가

            // 원래 인라인 스타일 저장(리버트 시 복구)
            ScrollTrigger.saveStyles([fullImg, bgStack, bTxt, images, ...steps]);

            // 측정 함수
            function measure() {
                const fullRect  = fullImg.getBoundingClientRect();
                const stackRect = bgStack.getBoundingClientRect();
                const cs        = getComputedStyle(bgStack);

                const left  = cs.left;
                const right = cs.right;

                // right가 실제로 쓰이고 있으면 right, 아니면 left를 사용
                const useRight = right !== 'auto' && !Number.isNaN(parseFloat(right));
                const sideProp = useRight ? 'right' : 'left';
                const sideVal  = (() => {
                    const v = parseFloat(useRight ? right : left);
                    return Number.isNaN(v) ? 0 : v;
                })();

                return {
                    fullW: fullRect.width,
                    fullH: fullRect.height,
                    init: {
                    width : stackRect.width,
                    height: stackRect.height,
                    radius: parseFloat(cs.borderRadius) || 0,
                    sideProp,  // 'left' 또는 'right'
                    sideVal    // 해당 축의 현재 값(px)
                    }
                };
            }

            // 초기 상태
            gsap.set(steps, { yPercent: -50, opacity: 0, force3D: true });
            if (steps[0]) gsap.set(steps[0], { opacity: 1 });

            let dims = measure();
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
                    // initVH(초기값 고정) 기반으로 end 길이 산정 → 모바일 주소창 높이 변동에도 안정
                    end: () => "+=" + (initVH * (images.length + 1.6)),
                    scrub: true,
                    pin: true,
                    anticipatePin: 1,
                    refreshPriority: 2,
                    invalidateOnRefresh: true,
                    onRefreshInit: () => {
                        // 기존 측정 초기화 유지
                        gsap.set(bgStack, { clearProps: "right,width,height,borderRadius" });
                        // ★ refresh 직전에도 핀 대상 높이 안정화 (주소창 변동 무시)
                        gsap.set(fullImg, { height: initVH });
                        dims = measure();
                    },

                    // 스크롤 진행 시: 먼저 전역 동기화 → 상태 바뀌었으면 클래스 적용
                    onUpdate: () => {
                        const prev = isCompanyExpanded;
                        syncExpandedFromTimeline();
                        if (isCompanyExpanded !== prev) applyExpandedClasses();
                    },

                    // 리프레시(리사이즈 등) 직후에도 현재 위치 기준으로 전역 동기화 + 적용
                    onRefresh: () => {
                        // 수직 중앙 보정 유지
                        gsap.set(bgStack, { top: "50%", yPercent: -50 });
                        // ★ refresh 직후에도 한 번 더 보정(깜빡임 방지)
                        gsap.set(fullImg, { height: initVH });

                        const prev = isCompanyExpanded;
                        syncExpandedFromTimeline();
                        if (isCompanyExpanded !== prev) applyExpandedClasses();
                    }
                }
            });

            // 라벨 & 트윈
            companyTL.addLabel('expandStart')
            .to(bgStack, {
                width: () => dims.fullW,
                height: () => dims.fullH,
                // 수직은 항상 중앙 유지
                top: "50%", yPercent: -50,
                // "현재 사용하는 수평 축"만 0으로 밀착 (좌/우 둘 다 건들지 않음)
                [dims.init.sideProp]: 0,
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
                width : () => dims.init.width,
                height: () => dims.init.height,
                // 원래 쓰던 축의 원래 값으로 복원
                [dims.init.sideProp]: () => dims.init.sideVal,
                top: "50%", yPercent: -50,
                borderRadius: () => dims.init.radius,
                duration: 1,
                clearProps: "x,y" // transform의 x,y만 초기화 (left/right는 건드리지 않음)
            }, "+=0.05")
            .call(() => {
                // 수직 중앙 스냅 안정화
                gsap.set(bgStack, { top: "50%", yPercent: -50 });
            });

            // 빌드 직후에도 현재 위치 기준으로 1회 반영(초기 깜빡임 방지)
            syncExpandedFromTimeline();
            applyExpandedClasses();
            
        }, "#companyCont"); // context 스코프
    }

    // 최초
    buildCompanyTimeline();
    ScrollTrigger.refresh();

    // ========================
    // 리사이즈/오리엔테이션/폰트 로드 후 재빌드
    // → "너비가 변할 때만" GSAP 리프레시/재빌드
    // ========================
    let resizeRafId = null;

    // 마지막 뷰포트 너비(소수점 반올림 오차 방지용 threshold 포함)
    let lastVW = (window.visualViewport?.width ?? window.innerWidth);
    const VW_EPS = 1; // 1px 이하는 무시

    function rebuildAllWidthChangeOnly() {
        // 1) 모드 체크 & 전환 처리
        const prevMode = isMobileMode;
        isMobileMode = isMobile();

        // 2) 경계 재계산(높이 변동만 있을 때도 최소한의 스크롤 로직 안정화)
        recalcAreaBounds();

        // 3) 모드 전환 시 상태 리셋/보정
        if (prevMode !== isMobileMode) {
            $html.removeClass('is-scroll-lock');
            $navBtn.removeClass('on').attr('aria-expanded', 'false');
            $navBtnWrap.removeClass('on is-hide');

            if (isMobileMode) {
                $menu.stop(true, true).hide();
                $navWrap.removeClass('reveal on');
            } else {
                $menu.stop(true, true).show();
                $navWrap.removeClass('reveal on');
                if (!isCompanyExpanded) $header.removeClass('is-hide');
            }
        }

        // 4) 스크롤/라벨 상태 보정
        handleScroll();
        syncNavBtnLabel();

        // 5) GSAP 타임라인 재빌드 + 리프레시
        buildCompanyTimeline();
        ScrollTrigger.refresh();
    }

    // “실제 너비 변화” 또는 “방향 전환”일 때만 전체 재빌드
    function onViewportResizeDebounced(force = false) {
        if (resizeRafId) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => {
            const curVW = (window.visualViewport?.width ?? window.innerWidth);
            const widthChanged = Math.abs(curVW - lastVW) > VW_EPS;

            if (force || widthChanged) {
                // 폭이 변했거나(브라우저 창 크기/디바이스 회전 등) 강제 요청일 때만 풀 리프레시
                lastVW = curVW;
                // 더블 rAF로 레이아웃 안정화 후 재빌드
                requestAnimationFrame(() => {
                    rebuildAllWidthChangeOnly();
                    resizeRafId = null;
                });
            } else {
                // 높이만 바뀐 상황(주소창/키보드/툴바) → 최소 보정만 수행
                recalcAreaBounds();
                handleScroll();
                resizeRafId = null;
            }
        });
    }

    // jQuery resize: 주소창 show/hide로도 불릴 수 있으므로 width 체크
    $win.off('resize.main').on('resize.main', () => onViewportResizeDebounced(false));

    // visualViewport: 모바일 주소창/키보드로 인한 height 변화가 잦음
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => onViewportResizeDebounced(false));
    }

    // 방향 전환은 무조건 재빌드
    $(window).off('orientationchange').on('orientationchange', () => onViewportResizeDebounced(true));

    // 폰트 로드 후(메트릭 변동 가능) → "너비 변화 여부" 판단 후 처리
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => onViewportResizeDebounced(false));
    }

});
