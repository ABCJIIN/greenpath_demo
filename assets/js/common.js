$(function () {

  // AOS
  AOS.init();

  // ========================
  // 캐시/상수
  // ========================
  const BP = 1280;
  const $win = $(window);
  const $html = $('html');
  const $header = $('header');
  const $main = $('.main');

  const $topBtn = $('.top-btn');

  const $first = $main.find('section').eq(0);
  const $second = $main.find('section').eq(1);
  const $word = $second.find('.word');

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
  let ticking = false;              // scroll rAF throttle
  let isCompanyExpanded = false;    // 풀스크린 확장 상태
  let isSnapping = false;           // 스냅 중복 방지
  let played = false;               // .word 애니 1회만
  let companyCtx = null;            // gsap.context
  let companyTL = null;             // 타임라인

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
      if (!node || !node.childNodes) return;
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
  if ($word.length) prepareWord($word);

  // 1섹션 → 2섹션 스냅
  $first.on('wheel.snapToSecond', function (e) {
    if (isSnapping) return;
    const dy = e.originalEvent.deltaY || 0;
    if (dy <= 0) return;                // 위로는 무시
    if (!firstDominant()) return;       // 첫 섹션 충분히 보일 때만
    if (e.cancelable) e.preventDefault();

    isSnapping = true;

    const prevBehavior = $html.css('scroll-behavior');
    $html.css('scroll-behavior', 'auto');

    const headerH = $header.outerHeight() || 0;
    const targetTop = Math.max(0, $second.offset().top - headerH);

    $('html, body').stop(true).animate({ scrollTop: targetTop }, 600, 'swing', function () {
      $html.css('scroll-behavior', prevBehavior);
      isSnapping = false;
      playWord();
    });
  });

  // 자연 스크롤로 내려간 경우도 .word 1회 재생
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (en.isIntersecting) { playWord(); obs.disconnect(); }
      });
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
  function syncNavBtnLabel() {
    const $active = $menu.find('a.on');
    const label = $active.length ? $.trim($active.text()) : $.trim($menu.find('a').first().text());
    $navBtn.find('span').text(label);
  }

  function getVisibleSection() {
    let maxVisibleRatio = 0;
    let mostVisibleId = null;

    const winH = window.innerHeight;
    const scrollY = window.scrollY || window.pageYOffset;
    const docH = $(document).height();
    const nearBottom = scrollY + winH >= docH - 2;

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
      if (y < areaTop) $navWrap.removeClass('reveal');
    }
  }

  $navBtn.on('click', function (e) {
    if (!isMobile()) return;
    e.preventDefault();
    e.stopPropagation();
    lastY = $win.scrollTop();
    $navBtn.hasClass('on') ? closeMenu() : openMenu();
  });

  $menu.on('click', 'a', function () {
    if (!isMobile()) return;
    $navBtn.find('span').text($.trim($(this).text()));
    closeMenu();
  });

  // ========================
  // .move-area 안/밖 + 스크롤 방향 -> header&nav 노출 제어
  // ========================
  function handleScroll() {
    const y = $win.scrollTop();
    const dir = y > lastY ? 'down' : (y < lastY ? 'up' : 'none');
    const inside = inMoveArea(y);
    const mobile = isMobile();
    const menuActive = mobile && ($navBtn.hasClass('on') || $menu.is(':visible') || $menu.is(':animated'));

    // 회사섹션 확장 중이면 헤더 고정 숨김
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

    // nav-wrap 고정
    $navWrap.toggleClass('is-fixed', y >= areaTop);

    // reveal 제어(모바일)
    if (mobile) {
      if (menuActive) {
        $navWrap.addClass('reveal');
      } else {
        $navWrap.toggleClass('reveal', y >= areaTop);
      }
    } else {
      $navWrap.removeClass('reveal');
    }

    // nav-btn-wrap 방향 토글(모바일)
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

  // scroll: rAF throttle
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
  // 앵커 스무스 스크롤
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
  // 회사소개 섹션 (GSAP)
  // ========================
  gsap.registerPlugin(ScrollTrigger);

  function buildCompanyTimeline() {
    // 기존 것 정리
    if (companyCtx) companyCtx.revert(true);

    companyCtx = gsap.context(() => {
      const section = document.querySelector("#companyCont .company-sec");
      if (!section) return;

      const fullImg = section.querySelector(".full_img");
      const bgStack = section.querySelector(".bg-stack");
      const bTxt = section.querySelector(".b_txt");
      const images = gsap.utils.toArray(section.querySelectorAll(".bg-img"));
      const steps = gsap.utils.toArray(section.querySelectorAll(".b_txt .step"));

      // 초깃값 저장 (revert 시 복구)
      ScrollTrigger.saveStyles([fullImg, bgStack, bTxt, images, ...steps]);

      // [FIX] 이미지 초기 가시상태 보정
      gsap.set(images, { opacity: (i) => (i === 0 ? 1 : 0) });
      gsap.set(steps, { yPercent: -50, opacity: 0, force3D: true });
      if (steps[0]) gsap.set(steps[0], { opacity: 1 });

      // 측정 함수
      function measure() {
        // [FIX] 측정 전 변형값 제거 후 측정
        gsap.set(bgStack, { clearProps: "transform" });

        const fullRect = fullImg.getBoundingClientRect();
        const stackRect = bgStack.getBoundingClientRect();
        const cs = getComputedStyle(bgStack);

        const left = cs.left;
        const right = cs.right;

        const useRight = right !== 'auto' && !Number.isNaN(parseFloat(right));
        const sideProp = useRight ? 'right' : 'left';
        const sideVal = (() => {
          const v = parseFloat(useRight ? right : left);
          return Number.isNaN(v) ? 0 : v;
        })();

        const radius = parseFloat(cs.borderRadius) || 0;

        return {
          fullW: fullRect.width,
          fullH: fullRect.height,
          init: {
            width: stackRect.width,
            height: stackRect.height,
            radius,
            sideProp,
            sideVal
          }
        };
      }

      let dims = measure();
      const EXPAND_TRIGGER_FRAC = 0.25;

      function syncExpandedFromTimeline() {
        const t = companyTL.time();
        const tStart = companyTL.labels.expandStart ?? 0;
        const tDone = companyTL.labels.expandDone ?? (tStart + 1);
        const tShrink = companyTL.labels.shrinkStart ?? companyTL.duration();
        const tTrigger = tStart + (tDone - tStart) * EXPAND_TRIGGER_FRAC;
        isCompanyExpanded = (t >= tTrigger && t < tShrink);
      }

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

          // [FIX] 리프레시 직전: 인라인 값/트랜스폼을 최대한 제거 후 최신 CSS 기준 재측정
          onRefreshInit: () => {
            // 좌우/크기/반경/수직위치/변형 모두 초기화 → 스타일시트 값으로 복귀
            gsap.set(bgStack, {
              clearProps: "left,right,width,height,borderRadius,top,yPercent,x,y,transform"
            });
            dims = measure();
          },

          // 진행 중 상태 동기화
          onUpdate: () => {
            const prev = isCompanyExpanded;
            syncExpandedFromTimeline();
            if (isCompanyExpanded !== prev) applyExpandedClasses();
          },

          // 리프레시 완료 후 보정
          onRefresh: () => {
            // 수직 중앙 기준 재정렬
            gsap.set(bgStack, { top: "50%", yPercent: -50 });
            const prev = isCompanyExpanded;
            syncExpandedFromTimeline();
            if (isCompanyExpanded !== prev) applyExpandedClasses();
          }
        }
      });

      // 확장
      companyTL
        .addLabel('expandStart')
        .to(bgStack, {
          width: () => dims.fullW,
          height: () => dims.fullH,
          top: "50%", yPercent: -50,
          [dims.init.sideProp]: 0,
          borderRadius: 0,
          duration: 1
        }, 'expandStart')
        .addLabel('expandDone');

      // 페이드/텍스트 스텝 체인지
      images.forEach((img, i) => {
        const nextImg = images[i + 1];
        const curStep = steps[i];
        const nextStep = steps[i + 1];

        if (nextImg) {
          companyTL.to(img, { opacity: 0, duration: 0.7 }, "+=0.05")
                   .to(nextImg, { opacity: 1, duration: 0.7 }, "<");
        }
        if (curStep && nextStep) {
          companyTL.to(curStep, { yPercent: -300, opacity: 0, duration: 0.55 }, "<")
                   .fromTo(nextStep, { yPercent: 50, opacity: 0 },
                                     { yPercent: -50, opacity: 1, duration: 0.55, immediateRender: false }, "<");
        }
      });

      // 축소 복귀
      companyTL
        .addLabel('shrinkStart')
        .to(bgStack, {
          width: () => dims.init.width,
          height: () => dims.init.height,
          [dims.init.sideProp]: () => dims.init.sideVal,
          top: "50%", yPercent: -50,
          borderRadius: () => dims.init.radius,
          duration: 1,
          clearProps: "x,y" // transform의 x,y만 초기화
        }, "+=0.05")
        .call(() => {
          // 수직 중앙 스냅 안정화
          gsap.set(bgStack, { top: "50%", yPercent: -50 });
        });

      // 초기 1회 반영(깜빡임 방지)
      syncExpandedFromTimeline();
      applyExpandedClasses();

    }, "#companyCont");
  }

  // 최초 빌드 + 강제 리프레시
  buildCompanyTimeline();
  ScrollTrigger.refresh(true); // [FIX] 최초에도 강제 재계산

  // ========================
  // 리사이즈/오리엔테이션/폰트 로드 후 재빌드
  // ========================
  let resizeRafId = null;

  function rebuildAll() {
    const prevMode = isMobileMode;
    isMobileMode = isMobile();

    recalcAreaBounds();

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

    handleScroll();
    syncNavBtnLabel();

    // [FIX] 순서 중요: 재빌드 → 강제 리프레시
    buildCompanyTimeline();
    ScrollTrigger.refresh(true);
  }

  function onResizeDebounced() {
    if (resizeRafId) cancelAnimationFrame(resizeRafId);
    resizeRafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rebuildAll();
        resizeRafId = null;
      });
    });
  }

  $win.off('resize.main').on('resize.main', onResizeDebounced);
  $(window).on('orientationchange', onResizeDebounced);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(onResizeDebounced);
  }

});