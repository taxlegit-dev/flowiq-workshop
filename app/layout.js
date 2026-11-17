import "./globals.css";

export const metadata = {
  title: "FlowIQ Automation · Workshop",
  description: "Every rupee at risk, found and fixed in one click.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
