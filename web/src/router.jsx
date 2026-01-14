import { createBrowserRouter } from "react-router-dom";
import { Home } from "./pages/Home";
import { Runs } from "./pages/Run";

export const router = createBrowserRouter([
    { path: "/", element: <Home /> },
    { path: "/runs", element: <Runs /> }
  ],
  {
    future: {
      v7_startTransition: true
    }
  });
