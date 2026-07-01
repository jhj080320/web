/* =============================================================================
 *  app.js  —  추천 로직 + 화면 동작
 *  목적 기반 생성형 AI 활용 추천 웹 서비스
 *
 *  흐름:
 *   1) 사용자가 자연어로 '하려는 작업'을 입력 (또는 카테고리 칩 선택)
 *   2) 입력 문장에서 키워드를 찾아 '작업 유형'을 점수화 → 가장 잘 맞는 유형 선택
 *   3) 유형에 연결된 추천 모델과 프롬프트 전략을 화면에 출력
 * ========================================================================== */

(function () {
  "use strict";

  /* ---------- 화면 요소 가져오기 ---------- */
  const $input = document.getElementById("task-input");
  const $recommendBtn = document.getElementById("recommend-btn");
  const $chips = document.getElementById("category-chips");
  const $result = document.getElementById("result");
  const $tipsGrid = document.getElementById("tips-grid");

  /* ===========================================================================
   *  추천 엔진: 입력 문장 → 작업 유형 점수화
   *  - 각 작업 유형의 keywords가 입력 문장에 몇 개나 등장하는지로 점수를 매김
   *  - 같은 점수면 데이터 정의 순서가 앞선 유형이 우선
   *  - 아무 키워드도 안 맞으면 null 반환 (범용 안내)
   * ========================================================================= */
  function detectTaskType(text) {
    const lowered = text.toLowerCase().replace(/\s+/g, " ");
    let best = null;
    let bestScore = 0;
    const matchedKeywords = [];

    TASK_TYPES.forEach(function (type) {
      let score = 0;
      const hits = [];
      type.keywords.forEach(function (kw) {
        if (lowered.indexOf(kw.toLowerCase()) !== -1) {
          score += 1;
          hits.push(kw);
        }
      });
      if (score > bestScore) {
        bestScore = score;
        best = type;
        matchedKeywords.length = 0;
        Array.prototype.push.apply(matchedKeywords, hits);
      }
    });

    return { type: best, score: bestScore, matched: matchedKeywords };
  }

  /* ---------- 모델 id 배열 → 카드 HTML ---------- */
  function renderModelCards(modelIds) {
    return modelIds
      .map(function (id, index) {
        const m = AI_MODELS[id];
        if (!m) return "";
        const rankLabel = index === 0 ? "1순위 추천" : index + 1 + "순위";
        const rankClass = index === 0 ? "model-card--best" : "";
        const strengthsHtml = m.strengths
          .map(function (s) {
            return "<li>" + escapeHtml(s) + "</li>";
          })
          .join("");
        return (
          '<div class="model-card ' + rankClass + '">' +
          '<div class="model-card__head">' +
          '<span class="model-rank">' + rankLabel + "</span>" +
          '<a class="model-link" href="' + m.url + '" target="_blank" rel="noopener">바로가기 ↗</a>' +
          "</div>" +
          '<h4 class="model-name">' + escapeHtml(m.name) + '<span class="model-vendor"> · ' + escapeHtml(m.vendor) + "</span></h4>" +
          '<p class="model-summary">' + escapeHtml(m.summary) + "</p>" +
          '<ul class="model-strengths">' + strengthsHtml + "</ul>" +
          '<p class="model-free">💰 ' + escapeHtml(m.free) + "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  /* ---------- 작업 유형 → 결과 HTML ---------- */
  function renderResult(detection, originalText) {
    const type = detection.type;

    // 매칭 실패: 범용 안내
    if (!type) {
      $result.innerHTML =
        '<div class="result-card result-card--empty">' +
        "<h3>🤔 작업 유형을 정확히 못 찾았어요</h3>" +
        "<p>조금 더 구체적으로 적어보거나, 아래 카테고리 중 하나를 눌러보세요.</p>" +
        '<p class="result-hint">예시: "환경 보호 주제로 800자 에세이 쓰고 싶어", ' +
        '"파이썬 코드 오류 고치고 싶어", "이 긴 글을 요약하고 싶어"</p>' +
        "</div>";
      $result.classList.add("is-visible");
      scrollToResult();
      return;
    }

    const strategy = type.strategy;
    const tipsHtml = strategy.tips
      .map(function (t) {
        return "<li>" + escapeHtml(t) + "</li>";
      })
      .join("");

    const matchedHtml = detection.matched.length
      ? '<p class="result-matched">입력에서 찾은 키워드: ' +
        detection.matched
          .map(function (k) {
            return '<span class="kw">' + escapeHtml(k) + "</span>";
          })
          .join(" ") +
        "</p>"
      : "";

    $result.innerHTML =
      '<div class="result-card">' +
      // 헤더: 어떤 유형으로 판단했는지
      '<div class="result-head">' +
      '<span class="result-icon">' + type.icon + "</span>" +
      "<div>" +
      '<p class="result-eyebrow">이 작업은 이렇게 분류했어요</p>' +
      '<h3 class="result-title">' + escapeHtml(type.label) + "</h3>" +
      '<p class="result-desc">' + escapeHtml(type.desc) + "</p>" +
      "</div>" +
      "</div>" +
      matchedHtml +
      // 1. 추천 모델
      '<section class="result-section">' +
      "<h4 class=\"section-title\">🤖 추천 AI 모델</h4>" +
      '<div class="model-grid">' + renderModelCards(type.models) + "</div>" +
      "</section>" +
      // 2. 프롬프트 전략
      '<section class="result-section">' +
      '<h4 class="section-title">🎯 추천 프롬프트 전략 — ' + escapeHtml(strategy.title) + "</h4>" +
      '<ul class="strategy-tips">' + tipsHtml + "</ul>" +
      "</section>" +
      // 3. 복사용 프롬프트 템플릿
      '<section class="result-section">' +
      '<h4 class="section-title">📋 바로 쓰는 프롬프트 템플릿</h4>' +
      '<div class="template-box">' +
      '<button class="copy-btn" type="button" data-copy>복사</button>' +
      '<pre class="template-text">' + escapeHtml(strategy.template) + "</pre>" +
      "</div>" +
      '<p class="template-hint">[대괄호] 부분을 너의 상황에 맞게 바꿔서 사용하세요.</p>' +
      "</section>" +
      "</div>";

    $result.classList.add("is-visible");

    // 복사 버튼 연결
    const copyBtn = $result.querySelector("[data-copy]");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyText(strategy.template, copyBtn);
      });
    }

    scrollToResult();
  }

  /* ---------- 클립보드 복사 ---------- */
  function copyText(text, btn) {
    const done = function () {
      const original = btn.textContent;
      btn.textContent = "복사됨 ✓";
      btn.classList.add("is-copied");
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove("is-copied");
      }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text, done);
      });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      /* 무시 */
    }
    document.body.removeChild(ta);
  }

  /* ---------- 결과로 부드럽게 스크롤 ---------- */
  function scrollToResult() {
    if ($result.scrollIntoView) {
      $result.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------- HTML 이스케이프 (안전하게 텍스트 출력) ---------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ===========================================================================
   *  추천 실행 (버튼/엔터/칩 공통 진입점)
   * ========================================================================= */
  function runRecommend(text) {
    const value = (text || "").trim();
    if (!value) {
      $input.focus();
      $input.classList.add("shake");
      setTimeout(function () {
        $input.classList.remove("shake");
      }, 500);
      return;
    }
    const detection = detectTaskType(value);
    renderResult(detection, value);
  }

  /* ---------- 카테고리 칩 만들기 ---------- */
  function buildChips() {
    const html = TASK_TYPES.map(function (type) {
      return (
        '<button class="chip" type="button" data-type="' + type.id + '">' +
        '<span class="chip-icon">' + type.icon + "</span> " +
        escapeHtml(type.label) +
        "</button>"
      );
    }).join("");
    $chips.innerHTML = html;

    // 칩 클릭 → 해당 유형 결과 바로 출력
    $chips.addEventListener("click", function (e) {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const id = btn.getAttribute("data-type");
      const type = TASK_TYPES.find(function (t) {
        return t.id === id;
      });
      if (!type) return;
      // 입력창에도 보여주고, 곧장 해당 유형으로 결과 출력
      $input.value = type.label + " 관련 작업을 하고 싶어";
      renderResult({ type: type, score: 1, matched: [] }, $input.value);
    });
  }

  /* ---------- 공통 팁 카드 만들기 ---------- */
  function buildTips() {
    $tipsGrid.innerHTML = GENERAL_TIPS.map(function (tip) {
      return (
        '<div class="tip-card">' +
        '<span class="tip-icon">' + tip.icon + "</span>" +
        '<h4 class="tip-title">' + escapeHtml(tip.title) + "</h4>" +
        '<p class="tip-text">' + escapeHtml(tip.text) + "</p>" +
        "</div>"
      );
    }).join("");
  }

  /* ===========================================================================
   *  초기화
   * ========================================================================= */
  function init() {
    buildChips();
    buildTips();

    $recommendBtn.addEventListener("click", function () {
      runRecommend($input.value);
    });

    // Ctrl/Cmd + Enter 로도 추천 실행
    $input.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runRecommend($input.value);
      }
    });

    // 연도 표기
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
