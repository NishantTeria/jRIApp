using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;

namespace RIAPP.DataService
{
    [DataContract]
    public class DbSetPermit
    {
        [DataMember]
        public bool canAddRow
        {
            get;
            set;
        }

        [DataMember]
        public bool canEditRow
        {
            get;
            set;
        }

        [DataMember]
        public bool canDeleteRow
        {
            get;
            set;
        }

        [DataMember]
        public bool canRefreshRow
        {
            get;
            set;
        }
    }
}
