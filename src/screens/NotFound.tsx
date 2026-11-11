import { Hud } from "../engine/Hud";
import { href } from "../ui/route";
import "./screens.css";

export function NotFound({ title = "Not found" }: { title?: string }) {
  return (
    <>
      <Hud />
      <section className="screen-in empty">
        <h1>{title}</h1>
        <a className="btn" href={href.home()}>Home</a>
      </section>
    </>
  );
}
