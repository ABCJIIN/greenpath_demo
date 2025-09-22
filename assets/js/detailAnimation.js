$(function() {
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

})