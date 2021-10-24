import { PageHeader } from "antd";
import React from "react";

export default function Header() {
  return (
    <a href="https://github.com/austintgriffith/scaffold-eth" target="_blank" rel="noopener noreferrer">
      <PageHeader
        title="DeFi Edu"
        subTitle="Learn DeFi by doing!"
        style={{ cursor: "pointer", backgroundColor: "#53D6FF", fontSize: "32px" }}
      />
    </a>
  );
}
