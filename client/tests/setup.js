import { vi } from 'vitest';
window.matchMedia=vi.fn(()=>({matches:false,addEventListener(){},removeEventListener(){}}));
window.scrollTo=vi.fn();HTMLElement.prototype.scrollTo=vi.fn();HTMLElement.prototype.scrollIntoView=vi.fn();
globalThis.EventSource=class{addEventListener(){}close(){}};
URL.createObjectURL=vi.fn(()=>'blob:test');URL.revokeObjectURL=vi.fn();
