import React from "react";
import { Composition } from "remotion";
import { MakerHeatDemo } from "./MakerHeatDemo";

export const MakerHeatRoot: React.FC = () => (
  <>
    <Composition
      id="MakerHeatDemo"
      component={MakerHeatDemo}
      durationInFrames={2520}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ voPrefix: "vo-" }}
    />
    <Composition
      id="MakerHeatDemoMF"
      component={MakerHeatDemo}
      durationInFrames={2520}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ voPrefix: "vo-mf-" }}
    />
  </>
);
