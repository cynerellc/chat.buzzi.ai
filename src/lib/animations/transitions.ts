import type { Transition } from "framer-motion";

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  type: "tween",
  duration: 0.2,
  ease: "easeOut",
};

export const fastTransition: Transition = {
  type: "tween",
  duration: 0.15,
  ease: "easeOut",
};

export const slowTransition: Transition = {
  type: "tween",
  duration: 0.3,
  ease: "easeInOut",
};

export const bounceTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

export const layoutTransition: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 35,
};
