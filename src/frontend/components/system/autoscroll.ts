export function autoscroll(scrollElem: any, index: number) {
    if (!scrollElem || index === undefined || index === null) return 0
    return scrollElem.querySelector(".ParentBlock")?.children?.[Math.max(0, index)]?.offsetTop - scrollElem.offsetTop
}
