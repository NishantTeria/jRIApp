using System;
using System.Runtime.Serialization;
using System.Collections.Generic;

namespace RIAPP.DataService
{
    [DataContract]
    public class Row
    {
        public Row()
        {
            this.values = new List<string>();
            key = string.Empty;
        }

        [DataMember]
        public List<string> values
        {
            get;
            set;
        }

       
        /// <summary>
        /// Unique key in DbSet - primary key values concantenated by ;
        /// used on client to uniquely identify Entities
        /// </summary>
        [DataMember]
        public string key
        {
            get;
            set;
        }

    }
}
