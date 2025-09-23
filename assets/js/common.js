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
  let ticking = false;          // scroll rAF throttle
  let isCompanyExpanded = false;// 풀스크린 확장 상태
  let isSnapping = false;       // 스냅 중복 방지
  let played = false;           // .word 애니 1회만
  let companyCtx = null;        // gsap.context
  let companyTL  = null;        // 타임라인

  // 타임라인 길이 안정화를 위한 초기 VH(고정 길이), 시각적 꽉참을 위한 동적 DVH(가변 표시)
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

  // 동적 뷰포트 높이 변수: 주소창 등장/퇴장에도 시각적으로 풀스크린 유지
  function setAppDVH() {
    const h = (window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--app-dvh', `${h}px`);
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
    if (dy <= 0) return;
    if (!firstDominant()) return;

    if (e.cancelable) e.preventDefault();
    isSnapping = true;

    const prevBehavior = $html.css('scroll-behavior');
    $html.css('scroll-behavior', 'auto');

    const headerH  = $header.outerHeight() || 0;
    const targetTop = Math.max(0, $second.offset().top - headerH);

    $('html, body').stop(true).animate(
      { scrollTop: targetTop }, 600, 'swing', function () {
        $html.css('scroll-behavior', prevBehavior);
        isSnapping = false;
        playWord();
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
  // 스크롤에 따른 header/nav-wrap 제어
  // ========================
  function handleScroll() {
    const y = $win.scrollTop();
    const dir = y > lastY ? 'down' : (y < lastY ? 'up' : 'none');
    const inside = inMoveArea(y);
    const mobile = isMobile();
    const menuActive = mobile && ($navBtn.hasClass('on') || $menu.is(':visible') || $menu.is(':animated'));

    if (isCompanyExpanded) {
      if (!$header.hasClass('is-hide')) $header.addClass('is-hide');
      if (!$navWrap.hasClass('on-company')) $navWrap.addClass('on-company');
      lastY = y;
      return;
    }

    if (inside) {
      if (dir === 'down') $header.addClass('is-hide');
      else if (dir === 'up') $header.removeClass('is-hide');
    } else {
      $header.removeClass('is-hide');
    }

    $navWrap.toggleClass('is-fixed', y >= areaTop);

    if (mobile) {
      if (menuActive) {
        $navWrap.addClass('reveal');
      } else {
        $navWrap.toggleClass('reveal', y >= areaTop);
      }
    } else {
      $navWrap.removeClass('reveal');
    }

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

  // 앵커 스무스 스크롤
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
  setAppDVH(); // 시각적 꽉참 변수 초기화

  // ========================
  // 회사소개 (GSAP)
  // ========================
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true }); // 주소창 show/hide 등 가짜 리사이즈 무시

  function buildCompanyTimeline() {
    if (companyCtx) companyCtx.revert(true);

    companyCtx = gsap.context(() => {
    const section  = document.querySelector("#companyCont .company-sec, .company-sec");
    if (!section) return;
    const fullImg  = section.querySelector(".full_img");
    const bgStack  = section.querySelector(".bg-stack");
    const bTxt     = section.querySelector(".b_txt");
    const images   = gsap.utils.toArray(section.querySelectorAll(".bg-img"));
    const steps    = gsap.utils.toArray(section.querySelectorAll(".b_txt .step"));

    // 타임라인 길이는 초기 값으로 고정(안정적 스크럽)
    if (initVH == null) initVH = (window.visualViewport?.height ?? window.innerHeight);

    ScrollTrigger.saveStyles([fullImg, bgStack, bTxt, images, ...steps]);

// ✅ 동적 높이 계산
const dvh = getComputedStyle(document.documentElement).getPropertyValue('--app-dvh').trim();
const viewHpx = (dvh && dvh.endsWith('px')) ? dvh : (window.visualViewport?.height ?? window.innerHeight) + 'px';

// 🚫 section에 height를 주지 말 것!  ← 여기 바뀜
// gsap.set(section, { height: viewHpx, minHeight: viewHpx });
gsap.set(section, { minHeight: viewHpx }); // <-- min-height만

// ✅ .inner는 굳이 height 100%가 아니어도 됩니다. (pinSpacing이 부모에 padding을 추가해야 해서)
// 필요하면 레이아웃용으로 min-height만 맞춰 주세요.
const inner = section.querySelector('.inner');
if (inner) gsap.set(inner, { minHeight: viewHpx });

// ✅ 꽉 차 보이는 '보이는 박스'는 .full_img에 직접 고정 픽셀 높이로
if (fullImg) gsap.set(fullImg, { height: viewHpx });

// 배경 스택은 컨테이너(=full_img) 채우기
if (bgStack) gsap.set(bgStack, { height: '100%' });
    

      function measure() {
        const fullRect  = fullImg.getBoundingClientRect();
        const stackRect = bgStack.getBoundingClientRect();
        const cs        = getComputedStyle(bgStack);

        const left  = cs.left;
        const right = cs.right;

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
            sideProp,
            sideVal
          }
        };
      }

      // 초기 상태
      gsap.set(steps, { yPercent: -50, opacity: 0, force3D: true });
      if (steps[0]) gsap.set(steps[0], { opacity: 1 });

      let dims = measure();
      const EXPAND_TRIGGER_FRAC = 0.25;

      function syncExpandedFromTimeline() {
        const t       = companyTL.time();
        const tStart  = companyTL.labels.expandStart ?? 0;
        const tDone   = companyTL.labels.expandDone  ?? (tStart + 1);
        const tShrink = companyTL.labels.shrinkStart ?? companyTL.duration();
        const tTrigger= tStart + (tDone - tStart) * EXPAND_TRIGGER_FRAC;
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
          end: () => "+=" + (initVH * (images.length + 1.6)), // 고정 길이
          scrub: true,
          pin: true,
          pinSpacing: true, 
          anticipatePin: 1,
          refreshPriority: 2,
          invalidateOnRefresh: true,

          onRefreshInit: () => {
            gsap.set(bgStack, { clearProps: "right,width,height,borderRadius" });
            dims = measure();
          },
          onUpdate: () => {
            const prev = isCompanyExpanded;
            syncExpandedFromTimeline();
            if (isCompanyExpanded !== prev) applyExpandedClasses();
          },
          onRefresh: () => {
            gsap.set(bgStack, { top: "50%", yPercent: -50 });
            const prev = isCompanyExpanded;
            syncExpandedFromTimeline();
            if (isCompanyExpanded !== prev) applyExpandedClasses();
          }
        }
      });

      // 확장
      companyTL.addLabel('expandStart')
        .to(bgStack, {
          width: "100%",        // 컨테이너(섹션) 100%
          height: "100%",       // 컨테이너(섹션) 100% → var(--app-dvh)를 따라감
          top: "50%", yPercent: -50,
          [dims.init.sideProp]: 0,
          borderRadius: 0,
          duration: 1
        }, 'expandStart')
        .addLabel('expandDone');

      // 이미지/텍스트 스텝 전환
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

      // 축소 복원
      companyTL.addLabel('shrinkStart')
        .to(bgStack, {
          width : () => dims.init.width,
          height: () => dims.init.height,
          [dims.init.sideProp]: () => dims.init.sideVal,
          top: "50%", yPercent: -50,
          borderRadius: () => dims.init.radius,
          duration: 1,
          clearProps: "x,y"
        }, "+=0.05")
        .call(() => {
          gsap.set(bgStack, { top: "50%", yPercent: -50 });
        });

      // 초기 1회 동기화
      syncExpandedFromTimeline();
      applyExpandedClasses();

    }, "#companyCont");
  }

  // 최초
  buildCompanyTimeline();
  ScrollTrigger.refresh();

  // ========================
  // 리사이즈/오리엔테이션/폰트 로드
  // → 가로폭 변할 때만 타임라인 재빌드/리프레시
  // → 높이 변화는 DVH만 갱신(시각적 꽉참 유지)
  // ========================
  let resizeRafId = null;
  let lastVW = (window.visualViewport?.width ?? window.innerWidth);
  const VW_EPS = 1; // 1px 이하는 무시

  function rebuildAllWidthChangeOnly() {
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

    buildCompanyTimeline();
    ScrollTrigger.refresh();
  }

  function onViewportResizeDebounced(force = false) {
    if (resizeRafId) cancelAnimationFrame(resizeRafId);
    resizeRafId = requestAnimationFrame(() => {
      const curVW = (window.visualViewport?.width ?? window.innerWidth);
      const widthChanged = Math.abs(curVW - lastVW) > VW_EPS;

      // 높이 변동: 항상 DVH 갱신(리프레시 없음)
      setAppDVH();

      if (force || widthChanged) {
        lastVW = curVW;
        requestAnimationFrame(() => {
          rebuildAllWidthChangeOnly();
          resizeRafId = null;
        });
      } else {
        recalcAreaBounds();
        handleScroll();
        resizeRafId = null;
      }
    });
  }

  // 이벤트 바인딩
  $win.off('resize.main').on('resize.main', () => onViewportResizeDebounced(false));

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => onViewportResizeDebounced(false));
  }

  $(window).off('orientationchange').on('orientationchange', () => onViewportResizeDebounced(true));

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => onViewportResizeDebounced(false));
  }

  // DVH 리스너(초기/변경)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setAppDVH);
  }
  $(window).on('orientationchange', setAppDVH);

});
