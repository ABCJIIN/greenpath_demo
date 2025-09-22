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

    $(".tab-menu").each(function () {
        const $tabMenu = $(this);
        const $tabList = $tabMenu.find(".tab-list > li");
        const $tabIndicator = $tabMenu.find(".tab-indicator");
        const $tabCont = $tabMenu.find(".tab-cont > div");
        const $html = $("html");

        function updateIndicator($tab) {
            const tabWidth = $tab.outerWidth();
            const tabOffset = $tab.position().left;
            $tabIndicator.css({ width: `${tabWidth}px`, left: `${tabOffset}px` });
        }

        function forceScrollTop() {
            const prev = $html.css("scroll-behavior");
            $html.css("scroll-behavior", "auto");
            window.scrollTo(0, 0);
            $html.css("scroll-behavior", prev);
        }

        function setActiveByIndex(idx, { updateHash = false } = {}) {
            if (idx < 0 || idx >= $tabList.length) return;
            const $tab = $tabList.eq(idx);
            const $panel = $tabCont.eq(idx);

            $tabList.removeClass("on");
            $tabCont.removeClass("on");
            $tab.addClass("on");
            $panel.addClass("on");

            updateIndicator($tab);

            if (updateHash) {
            const id = $panel.attr("id"); // "terms" / "privacy"
            if (id) history.replaceState(null, "", `#${id}`); // 점프 없이 URL만 갱신
            }

            if (typeof window.updateBarWidths === "function") {
            setTimeout(window.updateBarWidths, 0);
            }
        }

        function setActiveByHash(hash) {
            if (!hash) return false;
            const $panel = $tabCont.filter(hash);
            if (!$panel.length) return false;
            const idx = $tabCont.index($panel);
            setActiveByIndex(idx);
            return true;
        }

        // ===== 초기화: (A) __initialHash 우선 → (B) 기존 .on → (C) 첫 번째 탭
        let inited = false;

        // (A) head에서 저장해둔 초기 해시 사용 (native 점프는 이미 막힌 상태)
        if (window.__initialHash) {
            inited = setActiveByHash(window.__initialHash);
            // 해시 복원(점프 없음)
            history.replaceState(null, "", window.__initialHash);
        }

        // (B) .on이 붙어있으면 그걸로
        if (!inited) {
            const initIndex = Math.max(0, $tabList.index($tabList.filter(".on")));
            setActiveByIndex(initIndex);
        }

        // 안전핀: 초기엔 항상 최상단
        forceScrollTop();

        // 리사이즈
        $(window).on("resize", function () {
            updateIndicator($tabList.filter(".on"));
        });

        // 탭 클릭: 전환 + 해시 복원/갱신(점프 없음)
        $tabList.on("click", function (e) {
            e.preventDefault();
            const idx = $tabList.index(this);
            setActiveByIndex(idx, { updateHash: true });
            forceScrollTop(); // 탭 전환 시에도 항상 맨 위 원하시면 유지, 아니면 제거
        });

        // 뒤/앞으로 가기 or 외부에서 해시만 바뀌는 경우
        $(window).on("hashchange", function () {
            setActiveByHash(location.hash);
            forceScrollTop();
        });
    });

    // 클린온 첫번째 상세 설명 모션
    $('.detail-sec').each(function () {
        const $sec   = $(this);
        const $items = $sec.find('.motion-wrap li');
        if (!$items.length) return;

        // 각 아이템이 중앙에 도착한 뒤 'before'를 얼마나 보여줄지(ms)
        // 요구사항: item01은 바로(0ms), item02는 2초 후, item03은 원하면 조정(여기선 0ms)
        const HOLD_BEFORE = [0, 0, 0];

        // -------- 유틸 --------
        function setScale($el, s) {
            $el.css('transform', 'translate(-50%, -50%) scale(' + s + ')');
        }
        
        function animateScale($el, from, to, dur) {
            const d = $.Deferred();
            $({ v: from }).animate({ v: to }, {
                duration: dur,
                easing: 'swing',
                step: function (now) { setScale($el, now); },
                complete: function () { d.resolve(); }
            });
            return d.promise();
        }

        function resetBelow($li) {
            $li.stop(true, true).css({ top: '130%', left: '50%', opacity: 0 });
            setScale($li, 0.2);
            $li.find('.img-before').stop(true, true).css({ opacity: 1 });
            $li.find('.img-after').stop(true, true).css({ opacity: 0 });
        }

        function enterCenter(idx) {
            const $li = $items.eq(idx);
            // 시작 상태 보장
            $li.css({ top: '130%', opacity: 0 });
            setScale($li, 0.2);
            // 위치/투명도 + 스케일 동시 애니
            const p1 = $.Deferred();
            $li.animate({ top: '50%', opacity: 1 }, 1200, 'swing', function () { p1.resolve(); });
            const p2 = animateScale($li, 0.2, 1, 1200);
            return $.when(p1, p2).promise();
        }

        function exitUp(idx) {
            const $li = $items.eq(idx);
            const p1 = $.Deferred();
            $li.animate({ top: '-100%', opacity: 0 }, 1200, 'swing', function () { p1.resolve(); });
            const p2 = animateScale($li, 1, 0.2, 1200);
            return $.when(p1, p2).promise();
        }

        function swapImages(idx, delayBeforeMs) {
            const $li = $items.eq(idx);
            const $before = $li.find('.img-before');
            const $after  = $li.find('.img-after');
            // delayBefore 지난 후, before → after 페이드 (0.5s)
            return setTimeout(function () {
                $before.stop(true).animate({ opacity: 1 }, 500);
                $after .stop(true).delay(1000).animate({ opacity: 1 }, 500);
            }, delayBeforeMs);
        }

        // -------- 메인 타임라인 --------
        let playing = false;
        let timers  = [];

        function playFrom(idx) {
            playing = true;

            // 1) 현재 아이템을 중앙에 진입
            enterCenter(idx).then(function () {
                // 2) (아이템별 대기) 후 before → after 교체
                const hold = HOLD_BEFORE[idx] || 0;
                timers.push(swapImages(idx, hold));

                // 3) (대기 + 3초) 후 다음 아이템과 크로스 전환
                const wait = hold + 3000; // "before 보인 뒤 3초 후 after" 조건
                timers.push(setTimeout(function () {
                const next = (idx + 1) % $items.length;

                // 다음 아이템 시작 상태로 준비
                resetBelow($items.eq(next));

                // 현재 아이템만 위로 퇴장 (동시에 진행)
                exitUp(idx);
                // 다음 사이클 시작: 다음 아이템 중앙 진입은 playFrom(next) 내부에서 '한 번만' 수행
                playFrom(next);

                }, wait));
            });
        }

        function start() {
            if (playing) return;
            // 초기화
            $items.each(function () { resetBelow($(this)); });
            playFrom(0);
        }

        // 섹션이 보이면 시작
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    if (en.isIntersecting) {
                        start();
                        // 계속 보여줄 거면 주석 해제 안 함. 처음 진입 때만 시작하려면 아래 줄 주석 제거
                        // io.unobserve($sec[0]);
                    }
                });
            }, { threshold: 0.6 });
            io.observe($sec[0]);
        } else {
        // 폴백: 그냥 즉시 시작
        start();
        }
    });

    // 클린온 세번째 상세 설명 모션
    $('.detail-sec').each(function () {
        const $sec   = $(this);
        const $wrap  = $sec.find('.motion-wrap02');
        if (!$wrap.length) return;

        const $checks = $wrap.find('.chk-wrap .checkmark'); // 3개
        const $progs  = $wrap.find('.progress');            // 2개
        const $truck  = $wrap.find('.truck');               // 트럭

        // 실행 순서: 체크1 → 프로그1 → 체크2 → 프로그2 → 체크3 → (리셋) → 반복
        const steps = [
            { el: $checks.eq(0), type: 'check',    dur: 1000 }, // 첫 체크 1.0s
            { el: $progs.eq(0),  type: 'progress', dur: 1500 }, // 프로그1 1.5s
            { el: $checks.eq(1), type: 'check',    dur: 1500 }, // 체크2 1.5s
            { el: $progs.eq(1),  type: 'progress', dur: 1500 }, // 프로그2 1.5s
            { el: $checks.eq(2), type: 'check',    dur: 1000 }, // 마지막 체크 1.0s
        ];

        // CSS와 맞춰주세요 (@keyframes draw .9s + .1s delay, progress 1s)
        const CHECK_DUR    = 1000; // ms (안전 타임아웃)
        const PROGRESS_DUR = 1000; // ms
        const CYCLE_PAUSE  = 1500;  // 마지막 후 잠깐 쉬고 리셋

        let started = false;

        // 특정 요소만 애니 재시작 (다른 요소의 is-play는 건드리지 않음)
        function restartCssAnim($el, cls = 'is-play') {
            $el.removeClass(cls);
            // 강제 리플로우
            // eslint-disable-next-line no-unused-expressions
            $el.get(0).offsetWidth;
            $el.addClass(cls);
        }

        // 트럭 이동 헬퍼: progress 스텝 duration에 맞춰 이동 속도도 동기화
        function setTruck(state, instant = false, durMs) {
            if (!$truck.length) return;
            if (durMs) $truck.css('transition-duration', (durMs/1000) + 's');
            if (instant) $truck.addClass('no-anim');
            $truck.removeClass('is-right is-center is-left')
                    .addClass(state === 'center' ? 'is-center'
                            : state === 'left' ? 'is-left'
                            : 'is-right');
            if (instant) { $truck[0].offsetWidth; $truck.removeClass('no-anim'); }
        }

        // 사이클 리셋: 전부 is-play 제거 → 초기 상태로 복귀
        function resetAll() {
            $checks.removeClass('is-play');
            $progs.removeClass('is-play');
            setTruck('right', true); // ← 트럭을 오른쪽 밖으로 즉시 리셋
        }

        // 체크마크: .tick 애니 끝(이벤트)까지 기다림
        // 체크마크: 스텝별 duration 반영
        function playCheck($cm, durMs) {
            const d = $.Deferred();
            // duration 변수 주입 (tick 대상에 써도 되고 컨테이너에 써도 됨)
            $cm.get(0).style.setProperty('--check-dur', durMs + 'ms');
            // 필요하면 delay도 조정 가능: $cm.get(0).style.setProperty('--check-delay', '0.1s');

            restartCssAnim($cm); // is-play 재부여
            const $tick = $cm.find('.tick');

            const onEnd = (e) => {
                if (e.originalEvent && e.originalEvent.animationName !== 'draw') return;
                $tick.off('animationend webkitAnimationEnd', onEnd);
                d.resolve();
            };
            $tick.on('animationend webkitAnimationEnd', onEnd);

            // 안전 타임아웃 (durMs 기준)
            setTimeout(() => {
                $tick.off('animationend webkitAnimationEnd', onEnd);
                d.resolve();
            }, durMs + 200);

            return d.promise();
        }

        // 프로그레스(::before) 는 이벤트 잡기 어렵므로 시간 대기
        // 프로그레스: 스텝별 duration 반영
        function playProgress($pg, durMs) {
            const d = $.Deferred();
            $pg.get(0).style.setProperty('--progress-dur', durMs + 'ms');
            restartCssAnim($pg);
            setTimeout(() => d.resolve(), durMs + 50);
            return d.promise();
        }

        // 단계 실행 (이전 단계의 is-play는 절대 지우지 않음)
        function playStep(i = 0) {
            const step = steps[i];
            const dur  = step.dur;

            // 트럭 이동 훅 (progress 단계에서만)
            if (step.type === 'progress') {
                if (i === 1) setTruck('center', false, dur); // progress1: 오른쪽 -> 중앙 (1.5s)
                if (i === 3) setTruck('left',   false, dur); // progress2: 중앙 -> 왼쪽 (1.5s)
            }

            const run = step.type === 'check'
            ? playCheck(step.el, dur)
            : playProgress(step.el, dur);

            $.when(run).then(() => {
                const isLast = i === steps.length - 1;
                if (isLast) {
                    // 마지막 체크가 끝난 뒤 1.5초 대기 → 전체 리셋 → 처음부터
                    setTimeout(() => { resetAll(); playStep(0); }, CYCLE_PAUSE);
                } else {
                    playStep(i + 1);
                }
            });
        }

        function start() {
            if (started) return;
            started = true;
            resetAll();   // 시작 전 깔끔히 초기화
            playStep(0);  // 첫 단계부터 누적 실행
        }

        // 섹션 보일 때 1회 시작
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                if (en.isIntersecting) {
                    start();
                    io.unobserve($sec[0]); // 중복 방지
                }
                });
            }, { threshold: 0.6 });
            io.observe($sec[0]);
        } else {
        start();
        }
    });

    // 클린톡 첫번째 상세 설명 모션
    $('.detail-sec').each(function () {
        const $sec   = $(this);
        const $wrap  = $sec.find('.motion-wrap03');
        if (!$wrap.length) return;

        const $after = $wrap.find('.photo-after');

        // 타이밍(ms)
        const FIRST_DELAY   = 1000; // 섹션 도착 후 1초 기다렸다 시작
        const BLINK_DELAY   = 200;  // on 붙였다 떼는 간격 0.2초
        const BLINK_DELAY2  = 500;
        const LOOP_DELAY    = 1000; // 한 사이클 끝나고 다음 사이클 시작까지 1초

        let running = false;
        let timers  = [];

        function clearTimers() {
        timers.forEach(t => clearTimeout(t));
        timers = [];
        }

        function cycle() {
        if (!running) return;

        // 1) 1초 대기
        timers.push(setTimeout(() => {
            if (!running) return;

            // 2) on 붙이기
            $after.addClass('on');

            // 3) 0.2초 뒤 on 제거
            timers.push(setTimeout(() => {
            if (!running) return;
            $after.removeClass('on');

            // 4) 바로 다시 on 붙이기
            timers.push(setTimeout(() => {
                if (!running) return;
                $after.addClass('on');

                // 5) 0.2초 뒤 on 제거
                timers.push(setTimeout(() => {
                if (!running) return;
                $after.removeClass('on');

                // 6) 다음 사이클 (1초 뒤 재시작)
                timers.push(setTimeout(cycle, LOOP_DELAY));
                }, BLINK_DELAY2));
            }, BLINK_DELAY));
            }, BLINK_DELAY));
        }, FIRST_DELAY));
        }

        function start() {
        if (running) return;
        running = true;
        cycle();
        }

        function stop() {
        running = false;
        clearTimers();
        $after.removeClass('on'); // 깔끔하게 정리
        }

        // 화면에 보일 때만 실행/정지
        if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
            if (en.target !== $sec[0]) return;
            if (en.isIntersecting) start();
            else stop();
            });
        }, { threshold: 0.3 });
        io.observe($sec[0]);
        } else {
        // 폴백: 그냥 시작
        start();
        }
    });

    // 클린톡 세번째 상세 설명 모션
    const $paperSections = $('.detail-sec').has('.paper'); // paper 가진 섹션만

    const options = {
        root: null,
        threshold: 0.6
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const $sec = $(entry.target);
            const $paper = $sec.find('.paper');

            if (entry.isIntersecting) {
                $paper.addClass('is-play');
            } else {
                $paper.removeClass('is-play');
            }
        });
    }, options);

    $paperSections.each(function () {
        observer.observe(this);
    });



    // 회사소개
    gsap.registerPlugin(ScrollTrigger);

    window.addEventListener("load", () => {
        let companyCtx = null;       // gsap.context 저장
        let companyTL  = null;       // 타임라인 저장

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