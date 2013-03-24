using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAppDemo.BLL.Models
{
    public class AddressInfo
    {
        public int AddressID { get; set; }
        public string AddressLine1 { get; set; }
        public string City { get; set; }
        public string StateProvince { get; set; }
        public string CountryRegion { get; set; }
    }
}
