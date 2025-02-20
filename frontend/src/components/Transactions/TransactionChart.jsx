import React from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  plugins,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useQuery } from "@tanstack/react-query";
import { listTransationsAPI } from "../../services/transactions/transactionService";
import { GrMoney } from "react-icons/gr";
import { BsCashCoin } from "react-icons/bs";
import { BsHouseDash } from "react-icons/bs";

ChartJS.register(ArcElement, Tooltip, Legend);

const TransactionChart = () => {
  const {
    data: transactions,
    isError,
    error,
    isLoading,
    isFetched,
    refetch,
  } = useQuery({
    queryFn: listTransationsAPI,
    queryKey: ["list-transactions", "list-categories", "login"],
  });

  //!calculate total income and expense with "reduce function"
  const totals = transactions?.reduce(
    (acc, transaction) => {
      if (transaction?.type === "income") {
        acc.income += Number(transaction?.amount);
      } else {
        acc.expense += Number(transaction?.amount);
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  //!Data structure for chart
  const data = {
    labels: ["Income", "Expense"],
    datasets: [
      {
        label: "Transactions",
        data: [totals?.income, totals?.expense],
        backgroundColor: ["#36A2EB", "#FF6384"],
        borderColor: ["#36A2EB", "#FF6384"],
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 25,
          boxWidth: 12,
          font: {
            size: 14,
          },
        },
      },
      title: {
        display: true,
        text: "Income vs Expense",
        font: {
          size: 18,
          weight: "bold",
        },
        padding: {
          top: 10,
          bottom: 30,
        },
      },
    },
    cutout: "70%",
  };
  return (
    <>
      <div className="my-8 p-6 bg-white rounded-lg shadow-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-center mb-4">
          Transaction Overview
        </h1>
        <div className="grid lg:grid-cols-3 gap-8">
          <div
            style={{ height: "350px" }}
            className="relative flex justify-center max-w-xl items-center p-8 shadow-2xl rounded-2xl"
          >
            <div className="flex flex-col items-center justify-center max-w-2xl px-auto mx-auto absolute top-28 ">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-2xl  font-bold text-[#FF6384] text-center ">
                  Total
                </h3>
                <span>
                  <GrMoney className="text-red-300 text-xl" />
                </span>
              </div>
              <h3 className="text-3xl  font-bold text-[#36A2EB] text-center ">
                {totals?.income.toFixed(2) - (totals?.expense).toFixed(2)}
              </h3>
            </div>
            <Doughnut data={data} options={options} />
          </div>


          <div className="relative flex justify-between p-22 max-w-xl shadow-2xl rounded-2xl">
            <div className="items-center justify-center">
              <h3 className="text-3xl mb-2 font-bold text-[#36A2EB] mt-3">
                Total Income
              </h3>
              <div className="flex gap-4 ">
                <BsCashCoin className="text-4xl text-green-400" />
                <h3 className="font-bold text-6xl text-gray-500 text-center ">
                  S/. {(totals?.income).toFixed(2)}
                </h3>
              </div>
            </div>
          </div>

          <div className="relative flex justify-between max-w-xl p-22  shadow-2xl rounded-2xl">
            <div className="items-center justify-center">
              <h3 className="text-3xl mb-2 font-bold text-[#FF6384] mt-3">
                Total Expense
              </h3>
              <div className="flex gap-4">
                <BsHouseDash className="text-4xl text-orange-400" />
                <h3 className="font-bold text-6xl text-gray-500  text-center ">
                  S/. {(totals?.expense).toFixed(2)}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionChart;
