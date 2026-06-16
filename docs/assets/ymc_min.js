!function () {
    const e = document.currentScript,
        o = e?.dataset?.apikey || "",
        t = e?.dataset?.suggestApikey || "",
        r = [];
    window.ymaps;
    window.ymaps = {
        ready(e) {
            "function" == typeof e && r.push(e)
        }
    };
    const n = document.createElement("script");

    async function a(e) {
        if (!e || !e.trim()) throw new Error("Empty address");
        const o = (await ymaps.geocode(e, { results: 1 })).geoObjects.get(0);
        if (!o) throw new Error("Address not found");
        return o.geometry.getCoordinates()
    }
    n.src =
        `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${encodeURIComponent(o)}&suggest_apikey=${encodeURIComponent(t)}`,
        n.type = "text/javascript",
        n.referrerPolicy = "no-referrer",
        n.onload = function () {
            window.ymaps.ready(function () {
                ! function () {
                    if (window.geocodeAddress = a, !ymaps.multiRouter || !ymaps.multiRouter.MultiRoute)
                        return void console.warn(
                            "[ymaps-loader-patch] ymaps.multiRouter.MultiRoute not found");
                    const e = ymaps.multiRouter.MultiRoute;
                    ymaps.multiRouter.MultiRoute = function (e, o) {
                        const t = e.referencePoints,
                            r = new ymaps.GeoObjectCollection,
                            n = new ymaps.Polyline([], {}, { strokeWidth: 5, strokeColor: "#661eca", ...o });
                        r.add(n);
                        let s = null,
                            i = null;
                        const c = { requestsuccess: [], requestfail: [] };

                        function u(e) {
                            s = e, c[e] && c[e].forEach(e => {
                                try { e() } catch (e) {
                                    console.error(
                                        "[ymaps-loader-patch] route event callback error:", e)
                                }
                            })
                        }
                        return r.model = {
                            events: {
                                add(e, o) {
                                    return c[e] || (c[e] = []), c[e].push(o), s === e && setTimeout(o, 0),
                                        this
                                }
                            }
                        }, r.getActiveRoute = function () { return i },
                            async function (e) {
                                const [o, t] = e,
                                    r = await a(o),
                                    n = await a(t),
                                    s = [r[1], r[0]],
                                    i = [n[1], n[0]],
                                    c =
                                        `https://router.project-osrm.org/route/v1/driving/${s.join(",")};${i.join(",")}?overview=full&geometries=geojson`,
                                    u = await fetch(c),
                                    d = await u.json();
                                if (!d.routes || !d.routes[0]) throw new Error("Route not found");
                                const l = d.routes[0];
                                return {
                                    distanceMeters: l.distance,
                                    durationSeconds: l.duration,
                                    coordinates: l.geometry.coordinates.map(([e, o]) => [o, e]),
                                    from: o,
                                    to: t,
                                    fromCoords: r,
                                    toCoords: n
                                }
                            }(t).then(({ coordinates: e, distanceMeters: o, durationSeconds: t, from: a, to: s,
                                fromCoords: c, toCoords: d }) => {
                                n.geometry.setCoordinates(e);
                                const l = r.getMap();
                                if (l) {
                                    const e = window.matchMedia("(max-width: 767px)").matches;
                                    l.setBounds(n.geometry.getBounds(), {
                                        checkZoomRange: !0,
                                        zoomMargin: e ? [40, 40, 250, 40] : [40, 40, 40, 380]
                                    })
                                }
                                // УБИРАЕМ МЕТКИ "A" и "B"
                                // const p = new ymaps.Placemark(c, { iconContent: "A", iconCaption: a }, { preset: "islands#redIcon" });
                                // const m = new ymaps.Placemark(d, { iconContent: "B", iconCaption: s }, { preset: "islands#blueIcon" });
                                // r.add(p), r.add(m);
                                i = {
                                    properties: {
                                        get: e => "distance" === e ? { value: o, text: `${(o / 1e3).toFixed(1)} км` } :
                                            "duration" === e ? { value: t, text: `${Math.ceil(t / 60)} мин` } : null
                                    }
                                }, u("requestsuccess")
                            }).catch(e => {
                                console.error("[ymaps-loader-patch] route build failed:", e), u("requestfail")
                            }), r
                    }, ymaps.multiRouter.MultiRoute.prototype = e.prototype
                }(), r.forEach(e => {
                    try { e(window.ymaps) } catch (e) {
                        console.error(
                            "[ymaps-loader-patch] ready callback error:", e)
                    }
                })
            })
        }, n.onerror = function () {
            console.error("[ymaps-loader-patch] Failed to load Yandex Maps API")
        }, document.head.appendChild(n)
}();