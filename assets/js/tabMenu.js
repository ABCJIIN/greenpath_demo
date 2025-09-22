$(function(){
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
})