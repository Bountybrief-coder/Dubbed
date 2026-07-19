// Spread onto a non-button element (div/span/li) to give it real button
// semantics for keyboard and screen-reader users:
//   <div {...clickable(() => open(id))}>...</div>
// Enter/Space activate it, just like a native button.
export function clickable(onActivate) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate(e);
      }
    },
  };
}
