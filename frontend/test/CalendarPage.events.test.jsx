import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils/renderApp.jsx";
import inboxApi from "../src/api/inboxApi";
import CalendarPage from "../src/pages/calendar/CalendarPage.jsx";

test("loads events after clicking", async () => {
  // ✅ Use o mock roteável para endpoints específicos
  inboxApi.__mockRoute("GET", "/channels/calendar", () => ({
    data: {
      connected: true,
      calendars: [{ id: "cal1", summary: "Cal1" }],
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    },
  }));
  inboxApi.__mockRoute(
    "GET",
    /\/channels\/calendar\/events\?calendarId=cal1$/,
    () => ({ data: { items: [{ id: "evt1", title: "Meet" }] } })
  );

  renderApp(<CalendarPage />, { route: "/calendar" });

  // Calendário aparece
  expect(await screen.findByText("Cal1")).toBeInTheDocument();

  // Carrega eventos e verifica "Meet"
  const user = userEvent.setup({ pointerEventsCheck: 0, advanceTimers: jest.advanceTimersByTime });
  await user.click(screen.getByTestId("calendar-load"));
  expect(await screen.findByText("Meet")).toBeInTheDocument();
}, 10000);

