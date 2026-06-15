/* 核心智能演示脚本引擎 (Core Presentation JS Engine V4) */

document.addEventListener('DOMContentLoaded', () => {
    const deck = document.getElementById('deck');
    const slides = [...document.querySelectorAll('.slide')];
    let active = 0;
    let isOverview = false;
    let presenterWin = null;
    let peer = null;
    let peerConnection = null;

    function getNotes() {
        const notesEl = slides[active]?.querySelector('aside.notes');
        return notesEl ? notesEl.innerHTML : '(No Notes)';
    }

    function updatePresenterNotes() {
        if (presenterWin && !presenterWin.closed) {
            const notesNode = presenterWin.document.getElementById('n');
            if (notesNode) notesNode.innerHTML = getNotes();
        }
    }

    function resize() {
        if (!isOverview) {
            document.documentElement.style.setProperty('--scale', Math.min(window.innerWidth / 1280, window.innerHeight / 720));
        }
    }

    /* === 1. 灵动岛章节管家 (Chapter Pill) === */
    function initChapters() {
        const chapters = [];
        slides.forEach(s => {
            const chap = s.getAttribute('data-chapter');
            if (chap && !chapters.includes(chap)) chapters.push(chap);
        });
        if (chapters.length > 0) {
            const container = document.createElement('div');
            container.id = 'chapter-pill-container';
            chapters.forEach(c => {
                const seg = document.createElement('div');
                seg.className = 'chapter-segment';
                seg.innerText = c;
                container.appendChild(seg);
            });
            document.body.insertBefore(container, deck);
        }
    }

    /* === 底层翻页核心 === */
    function setSlide(i) {
        active = Math.max(0, Math.min(i, slides.length - 1));

        slides.forEach((s, n) => {
            s.classList.toggle('active', n === active);
            if (n === active && !isOverview) {
                [...s.querySelectorAll('.in')].forEach((el, idx) => {
                    el.style.transitionDelay = `${idx * 0.05}s`;
                });
            } else {
                [...s.querySelectorAll('.in')].forEach(el => {
                    el.style.transitionDelay = '0s';
                });
            }
        });

        const activeChapter = slides[active]?.getAttribute('data-chapter');
        if (activeChapter) {
            const segments = document.querySelectorAll('.chapter-segment');
            let found = false;
            segments.forEach(seg => {
                if (seg.innerText === activeChapter) {
                    seg.className = 'chapter-segment active';
                    found = true;
                } else {
                    seg.className = found ? 'chapter-segment' : 'chapter-segment past';
                }
            });
        }

        updatePresenterNotes();
        if (peerConnection) peerConnection.send({ type: 'SYNC_STATE', active, total: slides.length, notes: getNotes() });
        if (isOverview) slides[active].scrollIntoView({ behavior: 'smooth', block: 'center' });
        initSlideComponents(slides[active]);
    }

    function toggleOverview(forceState) {
        isOverview = forceState !== undefined ? forceState : !isOverview;
        deck.classList.toggle('overview-mode', isOverview);
        if (!isOverview) {
            resize();
            setSlide(active);
        } else {
            document.documentElement.style.setProperty('--scale', 1);
            setSlide(active);
        }
    }

    function togglePresenterView() {
        if (presenterWin && !presenterWin.closed) {
            presenterWin.focus();
            return;
        }
        presenterWin = window.open('', 'Presenter', 'width=800,height=600');
        presenterWin.document.write('<html><body style="background:#000;color:#fff;font-size:30px;padding:40px;"><div id="n">Waiting...</div></body></html>');
        presenterWin.document.close();
        updatePresenterNotes();
    }

    initChapters();

    /* 页码与点击 */
    slides.forEach((s, n) => {
        const pg = document.createElement('div');
        pg.className = 'page-num';
        pg.innerText = `${String(n + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
        const frame = s.querySelector('.frame');
        if (frame) frame.appendChild(pg);
        s.addEventListener('click', e => {
            if (isOverview) {
                e.stopPropagation();
                setSlide(n);
                toggleOverview(false);
            }
        });
    });

    deck.addEventListener('click', e => {
        if (isOverview || document.body.classList.contains('draw-mode')) return;
        const tagName = e.target.tagName.toLowerCase();
        if (tagName === 'canvas' || tagName === 'video' || tagName === 'button' || tagName === 'summary' || tagName === 'input' || tagName === 'label' || tagName === 'a') return;
        if (e.target.closest('.accordion, .tab-group, .stepper, .carousel, .toggle-switch, .toggle-panel, .quiz, .sortable-list, .image-compare, .flip-card, .hover-reveal, .confetti-trigger, .ripple, details')) return;
        if (e.clientX > window.innerWidth / 2) setSlide(active + 1);
        else setSlide(active - 1);
    });

    window.addEventListener('resize', resize);
    resize();

    /* === 2. 高阶平滑滚轮劫持 (Wheel Storytelling) === */
    let wheelTimeout;
    window.addEventListener('wheel', e => {
        if (isOverview) return;
        e.preventDefault();
        if (wheelTimeout) return;
        wheelTimeout = setTimeout(() => {
            if (e.deltaY > 20) setSlide(active + 1);
            else if (e.deltaY < -20) setSlide(active - 1);
            wheelTimeout = null;
        }, 300);
    }, { passive: false });

    /* === 3. 悬浮白板系统 (Annotation Canvas) === */
    const canvas = document.createElement('canvas');
    canvas.id = 'annotation-layer';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    canvas.addEventListener('mousedown', e => {
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', e => {
        if (!isDrawing) return;
        ctx.strokeStyle = '#0a84ff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0a84ff';
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();
    });
    canvas.addEventListener('mouseup', () => { isDrawing = false; });

    /* === 4. Python 活体沙盒 (Pyodide REPL) === */
    let pyodideReady = false;
    async function initPyodide() {
        if (pyodideReady) return window.pyodide;
        if (!window.loadPyodide) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
            document.head.appendChild(script);
            await new Promise(r => { script.onload = r; });
        }
        window.pyodide = await loadPyodide();
        pyodideReady = true;
        return window.pyodide;
    }

    document.querySelectorAll('.repl[data-lang="python"]').forEach(el => {
        const rawCode = el.innerText.trim();
        el.innerHTML = `
            <div class="repl-container">
                <div class="repl-header"><span></> Python 3.11</span><button class="repl-run-btn">Run</button></div>
                <textarea class="repl-code-editor" spellcheck="false">${rawCode}</textarea>
                <div class="repl-output"></div>
            </div>`;
        const btn = el.querySelector('.repl-run-btn');
        const editor = el.querySelector('.repl-code-editor');
        const output = el.querySelector('.repl-output');

        btn.addEventListener('click', async e => {
            e.stopPropagation();
            btn.innerText = 'Initializing...';
            btn.classList.add('loading');
            try {
                const pyodide = await initPyodide();
                btn.innerText = 'Running...';
                pyodide.runPython(`
                    import sys, io
                    sys.stdout = io.StringIO()
                    sys.stderr = io.StringIO()
                `);
                await pyodide.runPythonAsync(editor.value);
                const stdout = pyodide.runPython('sys.stdout.getvalue()');
                const stderr = pyodide.runPython('sys.stderr.getvalue()');
                output.innerText = stdout + stderr;
            } catch (err) {
                output.innerText = err.toString();
            } finally {
                btn.innerText = 'Run';
                btn.classList.remove('loading');
            }
        });
    });

    /* === 5. WebRTC 绝密移动端遥控 (PeerJS) === */
    function initRemoteController() {
        if (document.getElementById('remote-connect-overlay')) {
            document.getElementById('remote-connect-overlay').classList.toggle('show');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'remote-connect-overlay';
        overlay.innerHTML = `
            <div class="remote-modal">
                <h2>Mobile Presenter Pair</h2>
                <p>Scan the QR code with your phone or visit the URL</p>
                <div id="qrcode-container">Loading Engine...</div>
                <div>Connection Pin: <span class="remote-id-display" id="peer-id-display">----</span></div>
                <div style="margin-top:20px; font-size:12px; color:#666">Press R again to close</div>
            </div>`;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);

        const loadDependencies = async () => {
            if (!window.Peer) {
                const s1 = document.createElement('script');
                s1.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
                document.head.appendChild(s1);
                await new Promise(r => { s1.onload = r; });
            }
            if (!window.QRCode) {
                const s2 = document.createElement('script');
                s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                document.head.appendChild(s2);
                await new Promise(r => { s2.onload = r; });
            }
        };

        loadDependencies().then(() => {
            const peerId = 'PPT-' + Math.floor(1000 + Math.random() * 9000);
            peer = new Peer(peerId);
            peer.on('open', id => {
                document.getElementById('peer-id-display').innerText = id;
                document.getElementById('qrcode-container').innerHTML = '';
                const cURL = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/html_ppt_skill/resources/controller.html#' + id;
                new QRCode(document.getElementById('qrcode-container'), { text: cURL, width: 200, height: 200 });
                console.log('Remote controller URL:', cURL);
            });
            peer.on('connection', conn => {
                peerConnection = conn;
                overlay.classList.remove('show');
                conn.on('data', data => {
                    if (data.action === 'NEXT') setSlide(active + 1);
                    if (data.action === 'PREV') setSlide(active - 1);
                });
                conn.send({ type: 'SYNC_STATE', active, total: slides.length, notes: getNotes() });
            });
        });
    }

    /* === 按键总线映射 === */
    window.addEventListener('keydown', e => {
        if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;

        if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
            e.preventDefault();
            setSlide(active + 1);
        }
        if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
            e.preventDefault();
            setSlide(active - 1);
        }
        if (e.key === 'Home') {
            e.preventDefault();
            setSlide(0);
        }
        if (e.key === 'End') {
            e.preventDefault();
            setSlide(slides.length - 1);
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else if (document.exitFullscreen) document.exitFullscreen();
        }

        if (e.key === 'Escape' || e.key.toLowerCase() === 'o') {
            e.preventDefault();
            toggleOverview();
        }
        if (e.key.toLowerCase() === 'p') {
            e.preventDefault();
            togglePresenterView();
        }
        if (e.key.toLowerCase() === 'd') {
            document.body.classList.toggle('dark-mode');
        }
        if (e.key.toLowerCase() === 'l') {
            document.body.classList.toggle('laser-mode');
            document.body.classList.remove('draw-mode');
        }
        if (e.key.toLowerCase() === 'a') {
            document.body.classList.toggle('draw-mode');
            document.body.classList.remove('laser-mode');
        }
        if (e.key.toLowerCase() === 'c') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        if (e.key.toLowerCase() === 'r') {
            e.preventDefault();
            initRemoteController();
        }
    }, { passive: false });

    /* === 交互组件初始化 === */
    function initSlideComponents(slide) {
        if (!slide) return;

        /* Animated Counter */
        slide.querySelectorAll('.counter-up:not(.counted)').forEach(el => {
            const target = parseFloat(el.dataset.target || el.textContent);
            const suffix = el.dataset.suffix || '';
            const prefix = el.dataset.prefix || '';
            const decimals = (el.dataset.decimals || '0') | 0;
            const duration = parseFloat(el.dataset.duration || '1500');
            el.classList.add('counted');
            let startTime = performance.now();
            (function tick(now) {
                const p = Math.min((now - startTime) / duration, 1);
                const ease = 1 - Math.pow(1 - p, 3);
                el.textContent = prefix + (target * ease).toFixed(decimals) + suffix;
                if (p < 1) requestAnimationFrame(tick);
            })(startTime);
        });

        /* Stepper */
        slide.querySelectorAll('.stepper:not(.stepper-init)').forEach(stepper => {
            stepper.classList.add('stepper-init');
            const dots = stepper.querySelectorAll('.stepper-dot');
            const panels = stepper.querySelectorAll('.stepper-panel');
            const lines = stepper.querySelectorAll('.stepper-line-fill');
            dots.forEach((dot, i) => {
                dot.addEventListener('click', e => {
                    e.stopPropagation();
                    dots.forEach((d, j) => { d.classList.toggle('active', j === i); d.classList.toggle('done', j < i); });
                    panels.forEach((p, j) => p.classList.toggle('active', j === i));
                    lines.forEach((l, j) => { l.style.width = j < i ? '100%' : '0'; });
                });
            });
        });

        /* Carousel */
        slide.querySelectorAll('.carousel:not(.carousel-init)').forEach(c => {
            c.classList.add('carousel-init');
            const track = c.querySelector('.carousel-track');
            const carouselSlides = c.querySelectorAll('.carousel-slide');
            const dots = c.querySelectorAll('.carousel-dot');
            let idx = 0;
            function goTo(n) {
                idx = ((n % carouselSlides.length) + carouselSlides.length) % carouselSlides.length;
                track.style.transform = `translateX(-${idx * 100}%)`;
                dots.forEach((d, i) => d.classList.toggle('active', i === idx));
            }
            c.querySelectorAll('.carousel-btn.carousel-prev, .carousel-btn.prev').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); goTo(idx - 1); }));
            c.querySelectorAll('.carousel-btn.carousel-next, .carousel-btn.next').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); goTo(idx + 1); }));
            dots.forEach((d, i) => d.addEventListener('click', e => { e.stopPropagation(); goTo(i); }));
        });

        /* Typewriter */
        slide.querySelectorAll('.typewriter:not(.tw-init)').forEach(el => {
            el.classList.add('tw-init');
            const text = el.dataset.text || el.textContent;
            el.textContent = '';
            const cursor = document.createElement('span');
            cursor.className = 'tw-cursor';
            el.appendChild(cursor);
            let i = 0;
            const speed = parseInt(el.dataset.speed || '50');
            (function type() {
                if (i < text.length) { el.insertBefore(document.createTextNode(text[i]), cursor); i++; setTimeout(type, speed); }
            })();
        });

        /* Quiz / Poll */
        slide.querySelectorAll('.quiz:not(.quiz-init)').forEach(quiz => {
            quiz.classList.add('quiz-init');
            const correct = quiz.dataset.answer;
            const options = quiz.querySelectorAll('.quiz-option');
            const feedback = quiz.querySelector('.quiz-feedback');
            options.forEach(opt => {
                opt.addEventListener('click', e => {
                    e.stopPropagation();
                    if (quiz.classList.contains('answered')) return;
                    quiz.classList.add('answered');
                    options.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    const isCorrect = opt.dataset.value === correct;
                    opt.classList.add(isCorrect ? 'correct' : 'wrong');
                    if (!isCorrect) options.forEach(o => { if (o.dataset.value === correct) o.classList.add('correct'); });
                    if (feedback) { feedback.classList.add('show', isCorrect ? 'correct' : 'wrong'); feedback.textContent = isCorrect ? (quiz.dataset.correctMsg || '✓ 正确！') : (quiz.dataset.wrongMsg || '✗ 再想想'); }
                });
            });
        });

        /* Morphing Number */
        slide.querySelectorAll('.morph-number:not(.morph-init)').forEach(el => {
            el.classList.add('morph-init');
            const target = el.dataset.target || '0';
            el.textContent = '';
            target.split('').forEach(ch => {
                const digit = document.createElement('span');
                digit.className = 'morph-digit';
                const inner = document.createElement('span');
                inner.className = 'morph-digit-inner';
                for (let n = 0; n <= 9; n++) { const s = document.createElement('span'); s.textContent = n; inner.appendChild(s); }
                digit.appendChild(inner);
                el.appendChild(digit);
                const val = isNaN(ch) ? 0 : parseInt(ch);
                setTimeout(() => { inner.style.transform = `translateY(-${val * 1.2}em)`; }, 100);
            });
        });

        /* Toggle Switch */
        slide.querySelectorAll('.toggle-switch:not(.toggle-init)').forEach(ts => {
            ts.classList.add('toggle-init');
            const input = ts.querySelector('input[type="checkbox"]');
            const panels = ts.closest('.frame')?.querySelectorAll('.toggle-panel[data-toggle="' + (input?.name || '') + '"]');
            if (input && panels) {
                const update = () => panels.forEach(p => p.classList.toggle('active', p.dataset.value === (input.checked ? 'on' : 'off')));
                input.addEventListener('change', e => { e.stopPropagation(); update(); });
                ts.querySelector('.toggle-track')?.addEventListener('click', e => { e.stopPropagation(); input.checked = !input.checked; input.dispatchEvent(new Event('change')); });
                ts.querySelectorAll('.toggle-label').forEach(lbl => lbl.addEventListener('click', e => {
                    e.stopPropagation();
                    const isOn = lbl.classList.contains('toggle-label-on');
                    if (input.checked !== isOn) { input.checked = isOn; input.dispatchEvent(new Event('change')); }
                }));
                ts.addEventListener('click', e => e.stopPropagation());
                update();
            }
        });

        /* Image Compare */
        slide.querySelectorAll('.image-compare:not(.ic-init)').forEach(ic => {
            ic.classList.add('ic-init');
            const before = ic.querySelector('.img-before');
            const slider = ic.querySelector('.compare-slider');
            const handle = ic.querySelector('.compare-handle');
            function setPos(x) {
                const rect = ic.getBoundingClientRect();
                const pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
                if (before) before.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
                if (slider) slider.style.left = pct + '%';
                if (handle) handle.style.left = pct + '%';
            }
            let dragging = false;
            ic.addEventListener('mousedown', e => { e.stopPropagation(); dragging = true; setPos(e.clientX); });
            document.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
            document.addEventListener('mouseup', () => { dragging = false; });
        });

        /* SVG Path Draw */
        slide.querySelectorAll('.svg-draw:not(.drawn)').forEach(svg => {
            svg.querySelectorAll('path, line, polyline, circle, rect').forEach(p => {
                const len = p.getTotalLength ? p.getTotalLength() : 1000;
                p.style.setProperty('--path-length', len);
                p.style.strokeDasharray = len;
                p.style.strokeDashoffset = len;
            });
            requestAnimationFrame(() => svg.classList.add('drawn'));
        });

        /* Ripple Click */
        slide.querySelectorAll('.ripple:not(.ripple-init)').forEach(el => {
            el.classList.add('ripple-init');
            el.addEventListener('click', e => {
                const rect = el.getBoundingClientRect();
                const wave = document.createElement('span');
                wave.className = 'ripple-wave';
                const size = Math.max(rect.width, rect.height);
                wave.style.width = wave.style.height = size + 'px';
                wave.style.left = (e.clientX - rect.left - size / 2) + 'px';
                wave.style.top = (e.clientY - rect.top - size / 2) + 'px';
                el.appendChild(wave);
                wave.addEventListener('animationend', () => wave.remove());
            });
        });

        /* Mouse Parallax */
        slide.querySelectorAll('.parallax-container:not(.px-init)').forEach(pc => {
            pc.classList.add('px-init');
            const layers = pc.querySelectorAll('.parallax-layer');
            pc.addEventListener('mousemove', e => {
                const rect = pc.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                layers.forEach(l => {
                    const depth = parseFloat(l.dataset.depth || '0.1');
                    l.style.transform = `translate(${x * depth * 40}px, ${y * depth * 40}px)`;
                });
            });
        });

        /* Sortable List */
        slide.querySelectorAll('.sortable-list:not(.sort-init)').forEach(list => {
            list.classList.add('sort-init');
            let dragItem = null;
            list.querySelectorAll('.sortable-item').forEach(item => {
                item.draggable = true;
                item.addEventListener('dragstart', e => { e.stopPropagation(); dragItem = item; item.classList.add('dragging'); });
                item.addEventListener('dragend', () => { item.classList.remove('dragging'); dragItem = null; });
                item.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); if (dragItem && dragItem !== item) list.insertBefore(dragItem, item); });
            });
        });

        /* Confetti */
        slide.querySelectorAll('.confetti-trigger:not(.confetti-init)').forEach(btn => {
            btn.classList.add('confetti-init');
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const container = btn.closest('.frame')?.querySelector('.confetti-container') || btn.closest('.frame');
                if (!container) return;
                const colors = ['#00d4ff','#b24bf3','#ff2e97','#00ff88','#ffd700','#ff6b35'];
                for (let i = 0; i < 40; i++) {
                    const piece = document.createElement('div');
                    piece.className = 'confetti-piece';
                    piece.style.left = Math.random() * 100 + '%';
                    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
                    piece.style.setProperty('--fall-duration', (2 + Math.random() * 2) + 's');
                    piece.style.setProperty('--fall-delay', Math.random() * 0.5 + 's');
                    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
                    piece.style.width = (6 + Math.random() * 8) + 'px';
                    piece.style.height = (6 + Math.random() * 8) + 'px';
                    container.appendChild(piece);
                    piece.addEventListener('animationend', () => piece.remove());
                }
            });
        });
    }

    /* Tab-group 全局初始化 */
    document.querySelectorAll('.tab-group').forEach(group => {
        const labels = group.querySelectorAll('.tab-label');
        const panels = group.querySelectorAll('.tab-panel');
        labels.forEach(label => {
            label.addEventListener('click', e => {
                e.stopPropagation();
                const target = label.dataset.tab;
                labels.forEach(l => l.classList.toggle('active', l === label));
                panels.forEach(p => p.classList.toggle('active', p.dataset.tab === target));
            });
        });
    });

    setSlide(0);
});
