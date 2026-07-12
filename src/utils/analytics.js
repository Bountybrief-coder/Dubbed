const push = (evt) => {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push(evt);
  }
};

export const track = {
  signup:       ()              => push({ event: "sign_up" }),
  login:        ()              => push({ event: "login" }),
  deposit:      (amount)        => push({ event: "deposit", value: amount }),
  withdraw:     (amount)        => push({ event: "withdraw", value: amount }),
  matchCreate:  (game, entry)   => push({ event: "match_create", game, value: entry }),
  matchJoin:    (game, entry)   => push({ event: "match_join", game, value: entry }),
  tourneyJoin:  (name, entry)   => push({ event: "tourney_join", tournament: name, value: entry }),
  betPost:      (stake)         => push({ event: "bet_post", value: stake }),
  betAccept:    (stake)         => push({ event: "bet_accept", value: stake }),
  shopPurchase: (item, price)   => push({ event: "shop_purchase", item, value: price }),
  wagrUpgrade:  ()              => push({ event: "wagr_upgrade" }),
  pageView:     (page)          => push({ event: "page_view", page_title: page }),
};
