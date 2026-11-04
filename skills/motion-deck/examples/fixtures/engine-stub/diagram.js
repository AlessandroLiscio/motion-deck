// Stub of MotionDiagram (references/contract.md section 9): draws one rectangle per spec node, no animation.
window.MotionDiagram = {
  version: 1,
  steps: (spec) => Math.max(0, ...(spec.nodes || []).map((n) => n.step || 0)),
  mount(svg, spec) {
    (spec.nodes || []).forEach((n, i) => {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', 20 + i * 140); r.setAttribute('y', 20); r.setAttribute('width', 120); r.setAttribute('height', 60);
      r.setAttribute('fill', 'currentColor'); r.dataset.step = n.step || 0;
      svg.appendChild(r);
    });
    return { steps: this.steps(spec) };
  },
  update(svg, state) {
    svg.querySelectorAll('rect').forEach((r) => { r.style.visibility = state.capture || state.step >= +r.dataset.step ? 'visible' : 'hidden'; });
  },
};
